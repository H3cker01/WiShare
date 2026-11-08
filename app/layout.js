import "./globals.css";

export const metadata = {
  title: "WiShare",
  description: "Share files with anyone in your room.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
