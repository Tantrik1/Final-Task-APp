/** @type {import('tailwindcss').Config} */
module.exports = {
    // NOTE: Update this to include the paths to all of your component files.
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: "#FF5C00", // Hamro Task Orange
                    foreground: "#FFFFFF",
                },
                accent: {
                    DEFAULT: "#1E3A7B", // Hamro Task Navy
                    foreground: "#FFFFFF",
                },
                secondary: {
                    DEFAULT: "#FFF5F0",
                    foreground: "#FF5C00",
                },
                muted: {
                    DEFAULT: "#F1F5F9",
                    foreground: "#64748B",
                },
                background: "#FCFCFC",
                foreground: "#0F172A",
                border: "#E2E8F0",
            },
        },
    },
    plugins: [],
}
