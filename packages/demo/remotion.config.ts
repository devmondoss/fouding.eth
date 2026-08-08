import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// El clip ya viene a 1920×1080 desde Playwright: se compone 1:1, sin
// reescalar. Cualquier `--scale` distinto de 1 lo ablandaría.
Config.setScale(1);

// CRF 18 en h264: los paneles densos del producto tienen texto de 13px
// y el default (23) los ensucia justo donde el jurado tiene que leer.
Config.setCodec("h264");
Config.setCrf(18);
