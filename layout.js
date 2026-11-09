import "./globals.css";

export const metadata = {
  title: "WiShare",
  description: "Share files with anyone in your room.",
  verification: {
    google: "XeoRC4Eh8maq1j6oxDXjSVPskVIuKLw6us4rHdMf3bQ",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
