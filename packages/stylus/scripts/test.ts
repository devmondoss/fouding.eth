#!/usr/bin/env ts-node
/**
 * Stylus Cargo Test Runner
 *
 * This script runs tests for the actual members of the Stylus Cargo workspace.
 *
 * Features:
 * - Uses Cargo metadata as the canonical source of workspace membership
 * - Ignores templates and other explicitly excluded Cargo projects
 * - Runs `cargo test --locked` for each workspace member
 * - Shows real-time output during test execution
 * - Provides a comprehensive summary of test results
 * - Exits with appropriate error codes for CI/CD integration
 *
 * Usage:
 *   npm run test
 *   or
 *   ts-node scripts/test.ts
 */
import { spawn } from "child_process";
import * as path from "path";

interface CargoMetadata {
  packages: Array<{
    id: string;
    manifest_path: string;
    name: string;
  }>;
  workspace_members: string[];
}

interface CargoProject {
  name: string;
  path: string;
}

interface TestResult {
  project: string;
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Execute a command and return a promise with the result
 */
function executeCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    console.log(`\n🔄 Running tests in ${path.basename(cwd)}...`);
    console.log(`Executing: ${command} ${args.join(" ")}`);

    const childProcess = spawn(command, args, {
      cwd,
      shell: false,
      stdio: ["inherit", "pipe", "pipe"],
    });

    let output = "";
    let errorOutput = "";

    // Handle stdout
    if (childProcess.stdout) {
      childProcess.stdout.on("data", (data: Buffer) => {
        const chunk = data.toString();
        output += chunk;
        process.stdout.write(chunk); // Show real-time output
      });
    }

    // Handle stderr
    if (childProcess.stderr) {
      childProcess.stderr.on("data", (data: Buffer) => {
        const chunk = data.toString();
        errorOutput += chunk;
        process.stderr.write(chunk); // Show real-time errors
      });
    }

    // Handle process completion
    childProcess.on("close", (code: number | null) => {
      const success = code === 0;
      if (success) {
        console.log(
          `✅ Tests completed successfully in ${path.basename(cwd)}!`,
        );
      } else {
        console.log(
          `❌ Tests failed in ${path.basename(cwd)} with exit code ${code}`,
        );
      }

      resolve({
        success,
        output,
        ...(errorOutput && { error: errorOutput }),
      });
    });

    // Handle process errors
    childProcess.on("error", (error: Error) => {
      console.error(
        `❌ Error running tests in ${path.basename(cwd)}:`,
        error.message,
      );
      resolve({
        success: false,
        output: "",
        error: error.message,
      });
    });
  });
}

/**
 * Find the projects Cargo considers members of the production workspace.
 */
async function findCargoProjects(): Promise<CargoProject[]> {
  const contractsDir = path.resolve(__dirname, "..", "contracts");
  const metadata = await new Promise<CargoMetadata>((resolve, reject) => {
    const childProcess = spawn(
      "cargo",
      ["metadata", "--no-deps", "--format-version", "1", "--locked"],
      { cwd: contractsDir, shell: false, stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";

    childProcess.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    childProcess.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });
    childProcess.on("error", reject);
    childProcess.on("close", (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`cargo metadata failed: ${stderr.trim()}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as CargoMetadata);
      } catch (error) {
        reject(new Error(`Invalid cargo metadata output: ${String(error)}`));
      }
    });
  });

  const workspaceMembers = new Set(metadata.workspace_members);
  return metadata.packages
    .filter((cargoPackage) => workspaceMembers.has(cargoPackage.id))
    .map((cargoPackage) => ({
      name: cargoPackage.name,
      path: path.dirname(cargoPackage.manifest_path),
    }));
}

/**
 * Run tests for all Cargo projects
 */
async function runAllTests(): Promise<void> {
  console.log("🚀 Starting Stylus Cargo Tests...\n");

  const cargoProjects = await findCargoProjects();

  if (cargoProjects.length === 0) {
    console.log("❗ No Cargo projects found with Cargo.toml files.");
    process.exit(1);
  }

  console.log(`Found ${cargoProjects.length} Stylus Contract(s):`);
  cargoProjects.forEach((project) => {
    console.log(`  - ${project.name}`);
  });
  console.log("");

  const results: TestResult[] = [];

  // Run tests for each project
  for (const project of cargoProjects) {
    const result = await executeCommand(
      "cargo",
      ["test", "--locked", "--package", project.name],
      project.path,
    );

    results.push({
      project: project.name,
      success: result.success,
      output: result.output,
      ...(result.error && { error: result.error }),
    });
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`📦 Total projects: ${results.length}`);

  if (successful.length > 0) {
    console.log("\n✅ Successful projects:");
    successful.forEach((result) => {
      console.log(`  - ${result.project}`);
    });
  }

  if (failed.length > 0) {
    console.log("\n❌ Failed projects:");
    failed.forEach((result) => {
      console.log(`  - ${result.project}`);
      if (result.error) {
        console.log(`    Error: ${result.error.split("\n")[0]}`);
      }
    });
  }

  // Exit with error code if any tests failed
  if (failed.length > 0) {
    console.log("\n💥 Some tests failed!");
    process.exit(1);
  } else {
    console.log("\n🎉 All tests passed!");
    process.exit(0);
  }
}

// Main execution
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  });
}

export { runAllTests, findCargoProjects };
