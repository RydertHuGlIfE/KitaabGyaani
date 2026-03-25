"use client";

import axios from "axios";
import { UserIcon, X } from "lucide-react";
import React, { useEffect, useState } from "react";

function EditProfile({
  setEditProfile,
  user_id,
}: {
  setEditProfile: (value: boolean) => void;
  user_id: string | null;
}) {
  const [email, setEmail] = useState("");
  const [newName, setNewName] = useState("");
  const token = localStorage.getItem("token");

  const fetchUserData = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/get-user/${user_id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setEmail(response.data.email);
      setNewName(response.data.name);
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const handleEditProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const res = await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/update-profile/${user_id}`,
        { name: newName },
        { withCredentials: true }
      );
      if (res.status === 200) {
        setEditProfile(false);
      }
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  useEffect(() => {
    if (user_id) {
      fetchUserData();
    }
  }, []);

  return (
    <div className="bg-gray-100 p-8 rounded-lg shadow-md w-full max-w-md ">
      <div className="flex items-center justify-between border-b border-gray-400 pb-4">
        <h1 className="text-2xl text-blue-500 font-bold tracking-tight flex items-center gap-2">
          <UserIcon color="black" /> Edit Profile
        </h1>
        <h3>
          <X onClick={() => setEditProfile(false)} />
        </h3>
      </div>
      <form onSubmit={handleEditProfile}>
        <div className="my-4">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled
            placeholder="Enter your email"
            className="border my-1 p-3 rounded w-full outline-none bg-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 cursor-not-allowed"
            required
          />
        </div>
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Name
          </label>
          <input
            id="name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter your name"
            className="border my-1 p-3 rounded w-full outline-none bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            required
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="bg-blue-500 text-white py-2 px-4 rounded cursor-pointer hover:bg-blue-600 transition-all duration-200 mt-4 flex items-center"
          >
            Save Changes
          </button>
          <button
            onClick={() => setEditProfile(false)}
            className="bg-black text-white py-2 px-4 rounded cursor-pointer transition-all duration-200 mt-4 flex items-center"
          >
            Discard Changes
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditProfile;
