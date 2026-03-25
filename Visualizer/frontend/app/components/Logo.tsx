import React from "react";
import { playfair } from "../helper/fonts";
import LogoImage from "../../public/logo.png";
import Image from "next/image";

function Logo() {
  return (
    <div className="flex items-center justify-center gap-1">
      <div>
        <Image
          src={LogoImage}
          alt="Logo"
          className="h-8 w-10 bg-zinc-700 rounded-md"
        />
      </div>
      <div
        className={`text-2xl bg-gradient-to-b from-blue-400 to-purple-500 bg-clip-text font-black tracking-tighter text-transparent ${playfair.variable}`}
      >
        AICourseVisualizer
      </div>
    </div>
  );
}

export default Logo;
