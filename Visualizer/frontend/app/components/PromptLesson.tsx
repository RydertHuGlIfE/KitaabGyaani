"use client";

import RenderContent from "../components/RenderContent";
import { getFromDB, saveToDB } from "../helper/indexDB";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  History,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Plus,
  LogOut,
  User2,
} from "lucide-react";
import axios from "axios";
import React, { useState, useRef, useEffect } from "react";
import MermaidDiagram from "../helper/MermaidContentViewer";
import "../globals.css";
import { unauthorized, useRouter, useSearchParams } from "next/navigation";
import { playfair } from "../helper/fonts";
import Logo from "./Logo";
import EditProfile from "./EditProfile";
import toast from "react-hot-toast";
import { safeRender } from "../helper/safeParseCode";
import Link from "next/link";

const enum MODEL {
  GPT_4O_MINI = "gpt-4o-mini",
  GPT_OSS_20B_FREE = "gpt-oss-20b:free",
  GEMINI_2_5_FLASH = "gemini-2.5-flash",
}

interface HistoryItem {
  _id: string;
  title: string;
  timestamp: number;
  mermaidDiagram: string;
  model_used: string;
  subtopics: string[];
}

function PromptLesson() {
  const [prompt, setPrompt] = useState("");
  const [selectedNode, setSelectedNode] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [subtopicContent, setSubtopicContent] = useState("");
  const [searchHistory, setSearchHistory] = useState<HistoryItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const cachedNodesContent = useRef<Record<string, string>>({});
  const [mermaidCode, setMermaidCode] = useState("");
  const [model, setModel] = useState<MODEL | "">("");
  const [editProfile, setEditProfile] = useState(false);
  const [grade, setGrade] = useState("12");
  const [isStreaming, setIsStreaming] = useState(false);

  const router = useRouter();

  const user_id = useSearchParams().get("user_id");
  const token = useSearchParams().get("token");
  const name = useSearchParams().get("name");

  useEffect(() => {
    if (!user_id || !token) {
      router.push("/");
    }
  }, [user_id, token, router]);

  if (!token) {
    return <div className="h-screen w-full flex items-center justify-center">
      Please log in to access this content.
      <Link className="text-blue-500 hover:underline" href="/">Sign in</Link>
    </div>;
  }

  const fetchSearchHistory = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/lessons?user_id=${user_id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setSearchHistory(response.data);
      setPrompt(response.data[response.data.length - 1]?.title || "");
      setMermaidCode(
        response.data[response.data.length - 1]?.mermaidDiagram || ""
      );
      setModel(response.data[response.data.length - 1]?.model_used || "");
      setGrade(response.data[response.data.length - 1]?.grade || "12");
    } catch (error) {
      console.error("Error fetching search history:", error);
    }
  };

  const verifyToken = async () => {
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/verify-token`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 200) {
        if (!res?.data.valid) return unauthorized();
      }
    } catch (error) {
      console.error("Token verification failed:", error);
      router.push("/");
    }
  };

  const verifyUser = async () => {
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/verify-user/${user_id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 200) {
        if (!res?.data.exists) return unauthorized();
      }
    } catch (error) {
      console.error("User verification failed:", error);
      router.push("/");
    }
  }

  useEffect(() => {
    fetchSearchHistory();
    verifyToken();
    verifyUser();
  }, []);

  const handleHistoryClick = async (historyId: string) => {
    try {
      setLoading(true);

      const { data } = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/lesson/${historyId}?user_id=${user_id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Restore lesson title in the input
      if (data.title) setPrompt(data.title);

      // Restore diagram
      if (data.mermaidDiagram) {
        setMermaidCode(data.mermaidDiagram);
        setModel(data.model_used);
        setGrade(data.grade);
      } else {
        console.warn("No mermaidDiagram found in response:", data);
      }
    } catch (error) {
      console.error("Error fetching lesson:", error);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    if (confirm("Are you sure you want to clear the search history?")) {
      axios
        .delete(
          `${process.env.NEXT_PUBLIC_API_URL}/clear_history?user_id=${user_id}`
        )
        .then(() => {
          setSearchHistory([]);
        })
        .catch((error) => {
          console.error("Error clearing history:", error);
        });
    }
  };

  const handleDeleteHistory = (historyId: string) => {
    if (confirm("Are you sure you want to delete this search history?")) {
      axios
        .delete(
          `${process.env.NEXT_PUBLIC_API_URL}/clear/${historyId}?user_id=${user_id}`
        )
        .then(() => {
          setSearchHistory((prev) =>
            prev.filter((item) => item._id !== historyId)
          );
          setMermaidCode("");
        })
        .catch((error) => {
          console.error("Error deleting history:", error);
        });
    }
  };

  const handleNewChat = () => {
    setPrompt("");
    setMermaidCode("");
    setSubtopicContent("");
    setSelectedNode(null);
    setModel("");
  };

  const handleNodeClick = async (id: string, label: string) => {
    setSelectedNode({ id, label });

    if (cachedNodesContent.current[label]) {
      setSubtopicContent(cachedNodesContent.current[label]);
      return;
    }

    const cacheKey = `subtopic-${id}-${label}`;
    const cachedData = await getFromDB(cacheKey);

    if (cachedData && cachedData.content.content) {
      const isCacheValid =
        Date.now() - cachedData.timestamp < 24 * 60 * 60 * 1000;
      if (isCacheValid) {
        setSubtopicContent(cachedData.content.content);
        cachedNodesContent.current[label] = cachedData.content.content;
        return;
      }
    }

    try {
      setLoadingContent(true);
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/subtopic`,
        {
          lesson_name: prompt,
          subtopic_name: label,
          model: model || "gpt-4o-mini",
          grade: grade || "12",
        },
        { withCredentials: true }
      );
      if (res.status === 200) {
        toast.success("Subtopic content fetched successfully!");
        setSubtopicContent(res.data.subtopic_content);
      }

      cachedNodesContent.current[label] = res.data.subtopic_content;
      await saveToDB(cacheKey, {
        content: res.data.subtopic_content,
        timestamp: Date.now(),
      });
    } catch (error) {
      toast.error("Failed to fetch subtopic content. Please try again.");
      console.error("Error fetching node details:", error);
      setSubtopicContent("Failed to load content. Please try again.");
    } finally {
      setLoadingContent(false);
    }
  };

  const handleLogout = async () => {
    if (confirm("Are you sure you want to log out?")) {
      try {
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/logout`,
          {},
          { withCredentials: true }
        );

        if (res.status === 200) {
          toast.success("Logged out successfully!");
          router.push("/");
        }
      } catch (error) {
        toast.error("Failed to log out. Please try again.");
        console.error("Error logging out:", error);
      }
    }
  };

  const streamMermaidDiagram = async (e: React.FormEvent) => {
    e.preventDefault();
    setMermaidCode("");
    setIsStreaming(true);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/lesson/stream`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson_name: prompt,
          model,
          user_id,
          grade,
        }),
        credentials: "include",
      }
    );

    if (!response.body) {
      console.error("No response body");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let finalCode = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      finalCode += chunk;
      setMermaidCode((prev) => prev + chunk);
    }
    setIsStreaming(false);
    await saveMermaidDiagram(finalCode);
  };

  async function saveMermaidDiagram(mermaidCode: string) {
    if (prompt.trim()) {
      try {
        // setLoading(true);
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/lesson`,
          {
            lesson_name: prompt,
            model: model,
            user_id,
            grade: grade,
            mermaid_code: mermaidCode,
          },
          { withCredentials: true }
        );
        if (res.data && res.data.mermaid_code) {
          toast.success("Lesson flowchart created successfully!");
          // if (safeRender(res.data.mermaid_code)) {
          //   setMermaidCode(res.data.mermaid_code);
          // } else {
          //   toast.error("Invalid Mermaid diagram.");
          // }
        }
      } catch (error) {
        toast.error("Failed to create lesson flowchart.");
        console.error("Error:", error);
      } finally {
        // setLoading(false);
      }
    }
  }

  return (
    <div className="flex h-screen bg-black">
      {/* Sidebar */}
      <motion.div
        initial={false}
        animate={{ width: sidebarOpen ? 300 : 50 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="bg-zinc-900 text-white shadow-2xl border-r border-zinc-800 flex flex-col justify-between relative z-10"
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2"
            >
              <History className="text-blue-400" size={20} />
              <h2 className="font-semibold">Search History</h2>
            </motion.div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className=" hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            {sidebarOpen ? (
              <ChevronLeft size={18} />
            ) : (
              <ChevronRight size={18} />
            )}
          </button>
        </div>

        {/* Sidebar Content */}
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 overflow-y-auto no-scrollbar p-4"
          >
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
              onClick={() => setEditProfile(true)}
              className="w-full p-2 text-left bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700 flex items-center mb-4 gap-2 cursor-pointer"
            >
              <User2 color="white" />
              Account
            </motion.button>
            <div
              className="flex items-center gap-2 mb-8 cursor-pointer"
              onClick={handleNewChat}
            >
              <span className="bg-zinc-800 p-2 rounded-full hover:bg-zinc-700 transition-colors">
                <Plus size={16} />
              </span>
              <span>New chat</span>
            </div>
            {searchHistory.length > 0 ? (
              <>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-300">Recent searches</span>
                  <button
                    onClick={clearHistory}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
                <div className="space-y-2">
                  {searchHistory.map((item: HistoryItem, index) => (
                    <motion.button
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleHistoryClick(item._id)}
                      className="w-full p-3 text-left bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700"
                    >
                      <div className="text-sm truncate text-gray-200 flex items-center justify-between w-full">
                        <div className="w-4/5 overflow-x-auto no-scrollbar">
                          {item.title}
                        </div>
                        <div
                          className="hover:text-red-500 cursor-pointer"
                          onClick={() => handleDeleteHistory(item._id)}
                        >
                          <Trash2 size={15} />
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 mt-8">
                <History size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No search history yet</p>
              </div>
            )}
          </motion.div>
        )}
        <motion.div className="p-3">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
            onClick={handleLogout}
            className={`w-full p-2 text-left bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700 items-center mb-2 gap-2 cursor-pointer ${
              sidebarOpen ? "flex" : "hidden"
            }`}
          >
            <LogOut />
            Logout
          </motion.button>
        </motion.div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-x-auto">
        {/* Header */}
        <div className="bg-zinc-800 border-b border-zinc-700 py-3 flex items-center">
          <div className="max-w-4xl text-center mx-auto">
            <Logo />
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-zinc-800 border-b border-zinc-800 p-6 flex items-center justify-center">
          <div className="max-w-4xl mx-auto">
            <form
              onSubmit={streamMermaidDiagram}
              className="flex items-center md:flex-row flex-col gap-4"
            >
              <div className="flex md:items-start flex-col gap-3 ">
                <div className="flex flex-col md:flex-row items-center justify-between w-full gap-3 border border-zinc-700 rounded-xl px-2 md:py-3 py-2 bg-zinc-800">
                  <label
                    htmlFor="profession"
                    className="text-white md:text-md text-sm font-semibold"
                  >
                    For which class you want result for?
                  </label>
                  <select
                    name="profession"
                    id="profession"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="px-2 py-1 block border border-zinc-700 rounded-lg text-white bg-zinc-800 hover:bg-zinc-700 transition-colors md:ml-2"
                  >
                    <option value="select grade">Select Grade</option>
                    <option value="10">10th Grade</option>
                    <option value="12">12th Grade</option>
                    <option value="college">College</option>
                  </select>
                </div>
                <div className="relative flex items-center justify-between border border-zinc-700 px-2 rounded-xl">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={20}
                  />
                  <input
                    type="text"
                    placeholder="Enter the lesson you want for quick revision..."
                    className="w-full pl-10 pr-4 md:py-3 py-2 outline-none transition-all bg-zinc-800 text-white"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value as MODEL)}
                    name="model"
                    id="model"
                    className="px-2 py-1 md:block hidden border border-zinc-700 rounded-lg text-white bg-zinc-800 hover:bg-zinc-700 transition-colors ml-2"
                  >
                    <option value="select model">Model</option>
                    {/* <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                  <option value="openai/gpt-oss-20b:free">GPT-OSS</option> */}
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  </select>
                </div>
              </div>

              {/* Mobile */}
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as MODEL)}
                name="model"
                id="model"
                className="px-2 py-1 md:hidden block border border-zinc-700 rounded-lg text-white bg-zinc-800 hover:bg-zinc-700 transition-colors ml-2"
              >
                <option value="select model">Model</option>
                {/* <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                <option value="openai/gpt-oss-20b:free">GPT-OSS</option> */}
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              </select>

              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={loading || !prompt.trim()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white md:px-8 px-4 md:py-3 py-2 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
              >
                {loading ? "Processing..." : "Explore"}
              </motion.button>
            </form>
          </div>
        </div>

        {/* Diagram Section */}
        <div className="flex-1 overflow-auto md:p-6 p-3">
          <div className="max-w-9xl mx-auto overflow-x-auto no-scrollbar">
            {isStreaming && (
              <pre className="mt-4 p-2 bg-gray-100 rounded max-h-60 overflow-y-auto">
                {mermaidCode || "Generating diagram..."}
              </pre>
            )}
            {mermaidCode.length === 0 && (
              <div className="text-center text-gray-400 mt-16">
                <div className="text-lg">
                  <h1
                    className={`font-bold text-3xl capitalize mb-4 ${playfair.variable}`}
                  >
                    Welcome! {name}
                  </h1>
                  Start by entering a lesson topic above to generate an
                  interactive diagram.
                </div>
              </div>
            )}
            {!isStreaming && mermaidCode && (
              // <motion.div
              //   initial={{ opacity: 0 }}
              //   animate={{ opacity: 1 }}
              //   className="flex items-center justify-center h-64"
              // >
              //   <div className="text-center text-white">
              //     <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              //     <p className="text-gray-300">
              //       Loading your learning diagram...
              //     </p>
              //   </div>
              // </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={`bg-zinc-800 rounded-2xl shadow-xl border border-zinc-700 md:p-6 p-3 overflow-x-auto no-scrollbar ${
                  sidebarOpen ? "md:block hidden" : "block"
                }`}
              >
                <div className="mb-6">
                  <p className="text-gray-300">
                    Click on any node to explore detailed content and examples
                  </p>
                </div>
                <div className="border-2 border-dashed border-zinc-500 rounded-xl md:p-6 p-3 bg-gray-100 ">
                  <MermaidDiagram
                    code={mermaidCode}
                    onNodeClick={handleNodeClick}
                    isStreaming={isStreaming}
                  />
                </div>
              </motion.div>
            )}
            {/* ) : mermaidCode.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={`bg-zinc-800 rounded-2xl shadow-xl border border-zinc-700 md:p-6 p-3 overflow-x-auto no-scrollbar ${
                  sidebarOpen ? "md:block hidden" : "block"
                }`}
              >
                <div className="mb-6">
                  <p className="text-gray-300">
                    Click on any node to explore detailed content and examples
                  </p>
                </div>
                <div className="border-2 border-dashed border-zinc-500 rounded-xl md:p-6 p-3 bg-gray-100 ">
                  <MermaidDiagram
                    code={mermaidCode}
                    onNodeClick={handleNodeClick}
                    isStreaming={isStreaming}
                  />
                </div>
              </motion.div>
            ) : (
              <div className="text-center text-gray-400 mt-16">
                <div className="text-lg">
                  <h1
                    className={`font-bold text-3xl capitalize mb-4 ${playfair.variable}`}
                  >
                    Welcome! {name}
                  </h1>
                  Start by entering a lesson topic above to generate an
                  interactive diagram.
                </div>
              </div>
            )} */}
          </div>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ duration: 0.3 }}
              className="bg-white text-black rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            >
              <div className="flex justify-between items-center border-b border-zinc-700 p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <h2 className="text-2xl font-bold">{selectedNode.label}</h2>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-white hover:text-red-200 transition-colors p-1"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                {loadingContent ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center h-32"
                  >
                    <div className="text-center text-gray-300">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-3"></div>
                      <p>Loading content...</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <RenderContent subtopicContent={subtopicContent} />
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile page */}
      {editProfile && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 p-4"
        >
          <EditProfile setEditProfile={setEditProfile} user_id={user_id} />
        </motion.div>
      )}
    </div>
  );
}

export default PromptLesson;
