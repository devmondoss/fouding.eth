import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",

      /* El producto no usa iconografía de librería: la palabra completa el
         concepto y la espera es una regla que barre, no un aro girando (ver
         docs/design-system.md §5.1). Se barrieron 33 archivos y 60 glifos
         para llegar acá; sin esta regla el primer `import { Check }` los
         trae de vuelta de a uno. */
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lucide-react",
              message:
                "Sin iconografía de librería (design-system.md §5.1). Nombra la acción con palabras; para esperar usa components/ui/Waiting.",
            },
          ],
          patterns: [
            {
              group: ["react-icons/*", "@heroicons/*"],
              message:
                "Sin iconografía de librería (design-system.md §5.1). Nombra la acción con palabras.",
            },
          ],
        },
      ],
    },
  },
  {
    /* Andamio de scaffold-eth que no cuelga de ninguna superficie: el toast
       de `utils/scaffold-eth/notification.tsx` solo lo llama
       `hooks/scaffold-eth/*`, y ningún archivo de `app/` o `components/`
       importa esos hooks — o sea que sus heroicons no se pintan nunca. Se
       exime en vez de barrerse para no reescribir código muerto, pero queda
       nombrado acá: si algún día un hook de scaffold se usa de verdad, ese
       toast entra al barrido. */
    files: ["utils/scaffold-eth/**", "components/assets/**"],
    rules: { "no-restricted-imports": "off" },
  },
]);

export default eslintConfig;
