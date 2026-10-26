// Vite's `?raw` suffix imports a file as a string (the tests use it to load
// styles.css into jsdom). Declared here because the package does not pull in
// `vite/client` types.
declare module "*?raw" {
    const content: string;
    export default content;
}
