"use client";

import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Logo from "./Logo";
import Bulb from "../../public/bulb-ai.png";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRightLeft } from "lucide-react";
import toast from "react-hot-toast";

function VerifyOtp() {
  const [otp, setOtp] = useState("");
  const email = useSearchParams().get("email");
  const name = useSearchParams().get("name");
  const [loading, setLoading] = useState(false);
  const [side, setSide] = useState(true);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/verify-otp`,
        { email, name, otp },
        { withCredentials: true }
      );
      if (res.status === 200) {
        toast.success("OTP verified successfully!");
        localStorage.setItem("token", res.data.user.token);
        const secure =
          typeof window !== "undefined" &&
          window.location.protocol === "https:";
        document.cookie = `token=${encodeURIComponent(
          res?.data?.user?.token
        )}; Max-Age=${60 * 60 * 24 * 7}; Path=/; SameSite=Lax${
          secure ? "; Secure" : ""
        }`;
        router.push(
          `/prompt-lesson?name=${encodeURIComponent(
            res?.data?.user?.name
          )}&user_id=${encodeURIComponent(
            res?.data?.user?.id
          )}&token=${encodeURIComponent(res?.data?.user?.token)}`
        );
      }
    } catch (error) {
      toast.error("Failed to verify OTP. Please try again.");
      console.error("Error submitting form:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen bg-gray-100 relative overflow-hidden">
      {/* Black section with bulb - Hidden on mobile */}
      <motion.div
        className="w-1/2 bg-black items-center z-30 justify-center border-l border-gray-300 h-screen overflow-hidden absolute hidden md:flex"
        animate={{
          x: side ? "100%" : "0%",
        }}
        transition={{
          duration: 0.8,
          ease: "easeInOut",
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0.6 }}
          animate={{
            scale: [0.9, 1.1, 0.95, 0.9],
            opacity: [0.5, 0.8, 0.6, 0.5],
            rotate: [0, 15, -15, 0],
            transition: {
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            },
          }}
          className="absolute w-[250px] h-[280px] lg:w-[340px] lg:h-[400px] rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 blur-3xl"
        />

        <Image
          src={Bulb}
          alt="Bulb"
          height={600}
          className="absolute z-30 lg:h-[700px]"
        />
      </motion.div>

      {/* Form section */}
      <motion.div
        className="w-full h-screen flex items-center justify-center md:w-1/2 md:absolute px-4 sm:px-6"
        animate={{
          x:
            typeof window !== "undefined" && window.innerWidth >= 768
              ? side
                ? "0%"
                : "100%"
              : "0%",
        }}
        transition={{
          duration: 0.8,
          ease: "easeInOut",
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="bg-white px-4 py-6 sm:px-6 rounded-lg shadow-md w-full max-w-sm sm:max-w-md relative z-10"
        >
          <div className="py-4 border-b border-gray-300 mb-6">
            <Logo />
          </div>
          <div className="mb-6">
            <label
              htmlFor="otp"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              OTP
            </label>
            <input
              id="otp"
              type="text"
              placeholder="Enter the OTP"
              className="border my-1 p-3 rounded w-full outline-none bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center justify-center w-full">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-400 text-white px-6 py-3 rounded-lg w-full cursor-pointer hover:bg-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed transition-all duration-200 font-semibold text-sm sm:text-base"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Toggle button - Hidden on mobile */}
      <div
        onClick={() => setSide(!side)}
        className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 p-2 lg:p-3 rounded-full absolute right-[47%] sm:right-[48%] lg:right-[48.3%] top-1/2 transform -translate-y-1/2 cursor-pointer hover:scale-105 transition-transform duration-200 z-40 hidden md:block"
      >
        <ArrowRightLeft size={32} className="lg:w-10 lg:h-10" />
      </div>

      {/* Mobile background decoration */}
      <div className="md:hidden absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <motion.div
          initial={{ scale: 0.5, opacity: 0.3 }}
          animate={{
            scale: [0.5, 0.7, 0.6, 0.5],
            opacity: [0.2, 0.4, 0.3, 0.2],
            rotate: [0, 10, -10, 0],
            transition: {
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            },
          }}
          className="absolute -top-20 -right-20 w-[200px] h-[200px] sm:w-[300px] sm:h-[300px] rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 blur-3xl"
        />
        <motion.div
          initial={{ scale: 0.3, opacity: 0.2 }}
          animate={{
            scale: [0.3, 0.5, 0.4, 0.3],
            opacity: [0.1, 0.3, 0.2, 0.1],
            rotate: [0, -15, 15, 0],
            transition: {
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            },
          }}
          className="absolute -bottom-20 -left-20 w-[150px] h-[150px] sm:w-[250px] sm:h-[250px] rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 blur-3xl"
        />
      </div>
    </div>
  );
}

export default VerifyOtp;
