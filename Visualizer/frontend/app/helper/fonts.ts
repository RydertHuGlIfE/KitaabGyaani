import { Roboto, Inter, Playfair_Display, Lato } from "next/font/google";

export const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin"] });
export const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
export const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-playfair",
});
export const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-lato",
});
