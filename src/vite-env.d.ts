/*

it is only needed for build

This directive only works if you have the @types/node; Triple-slash directive that tells the TypeScript compiler to include type definitions from Vite's client-side package.

Without this reference, TypeScript wouldn't recognize Vite-specific globals and APIs like import.meta.env. 
*/


/// <reference types="vite/client" />
