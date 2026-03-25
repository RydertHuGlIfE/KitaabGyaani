import type { Metadata } from "next";
import { Roboto, Inter, Playfair_Display, Lato } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-playfair",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-lato",
});

export const metadata: Metadata = {
  title: "AI Course Visualizer",
  description:
    "A web application that makes quick revison easier and accessible at a single place for a specific lesson which is very handy at the time of last minute.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${roboto.variable} ${inter.variable} ${playfair.variable} ${lato.variable} antialiased`}
      >
        <Toaster position="bottom-right" reverseOrder={false} />
        {children}
      </body>
    </html>
  );
}
