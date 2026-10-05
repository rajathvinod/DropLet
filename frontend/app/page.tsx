"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Folder as FolderIcon,
  File as FileIcon,
  MoreVertical,
  Trash2,
  Edit2,
  Upload,
  Plus,
  ChevronRight,
  Download,
  Search,
  LayoutGrid,
  List,
  HardDrive,
  Star,
  Users,
  Clock,
  Settings,
  LogOut,
  X,
  RotateCcw
} from "lucide-react";

type User = {
  id: number;
  name: string;
  email: string;
};

type Folder = {
  id: number;
  name: string;
  parentId: number | null;
  createdAt: string;
  isStarred: boolean;
  isDeleted: boolean;
};

type FileItem = {
  id: number;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  isStarred: boolean;
  isDeleted: boolean;
};

type Breadcrumb = {
  id: number | null;
  name: string;
};

export default function PremiumDrivePage() {
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Navigation State
  const [section, setSection] = useState<"mydrive" | "starred" | "trash">("mydrive");
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: null, name: "My Drive" }]);
  const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id;

  // UI State
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<{ type: 'folder' | 'file', id: number } | null>(null);

  // Modals State
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ type: 'folder' | 'file', id: number, currentName: string } | null>(null);
  const [newFolderName, setNewFolderName] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("http://localhost:8080/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          router.push("/login");
        }
      } catch (e) {
        router.push("/login");
      }
    };
    fetchUser();
  }, [router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const url = new URL("http://localhost:8080/api/folders");
      url.searchParams.append("section", section);
      if (currentFolderId && section === "mydrive") {
        url.searchParams.append("parentId", currentFolderId.toString());
      }

      const res = await fetch(url.toString(), {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders);
        setFiles(data.files);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentFolderId, section]);

  const changeSection = (newSection: "mydrive" | "starred" | "trash") => {
    setSection(newSection);
    setBreadcrumbs([{ id: null, name: newSection === 'mydrive' ? "My Drive" : newSection === 'starred' ? "Starred" : "Trash" }]);
    setSearchQuery("");
  };

  const navigateToFolder = (folder: Folder) => {
    if (section !== "mydrive") return; // Only navigate deeply in mydrive
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    if (section !== "mydrive") return;
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const res = await fetch("http://localhost:8080/api/folders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName, parentId: currentFolderId }),
      });

      if (res.ok) {
        setNewFolderName("");
        setIsCreateFolderModalOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ticketRes = await fetch("http://localhost:8080/api/upload/ticket", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!ticketRes.ok) throw new Error("Failed to get ticket");
      const { url, key } = await ticketRes.json();

      const uploadRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (uploadRes.ok) {
        const dbRes = await fetch("http://localhost:8080/api/files", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            s3Key: key,
            size: file.size,
            mimeType: file.type,
            folderId: currentFolderId,
          }),
        });
        if (dbRes.ok) {
          fetchData();
        }
      }
    } catch (error) {
      console.error(error);
      alert("Upload failed.");
    }
  };

  const handleUpdateItem = async (type: 'folder' | 'file', id: number, updates: any) => {
    try {
      const res = await fetch(`http://localhost:8080/api/${type}s/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        fetchData();
        setActiveDropdown(null);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeletePermanently = async (type: 'folder' | 'file', id: number) => {
    try {
      const res = await fetch(`http://localhost:8080/api/${type}s/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        fetchData();
        setActiveDropdown(null);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !newFolderName.trim()) return;
    await handleUpdateItem(renameTarget.type, renameTarget.id, { name: newFolderName });
    setIsRenameModalOpen(false);
    setRenameTarget(null);
    setNewFolderName("");
  };

  const openRenameModal = (type: 'folder' | 'file', id: number, currentName: string) => {
    setRenameTarget({ type, id, currentName });
    setNewFolderName(currentName);
    setIsRenameModalOpen(true);
    setActiveDropdown(null);
  };

  const handleOpenFile = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`http://localhost:8080/api/files/${id}/link`, { credentials: 'include' });
      if (res.ok) {
        const { url } = await res.json();
        // Redirect or open in new tab
        window.open(url, '_blank');
      } else {
        alert("Access Denied: You do not have permission to view this file.");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex h-screen bg-[#F9FAFB] font-sans text-gray-800">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col z-20">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <div className="flex items-center gap-2 text-blue-600">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-xl leading-none">D</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">Droplet</span>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-1 mt-2">
          <button 
            onClick={() => changeSection('mydrive')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all ${section === 'mydrive' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <HardDrive className={`w-5 h-5 ${section === 'mydrive' ? 'text-blue-600' : 'text-gray-400'}`} /> My Drive
          </button>
          <button 
            onClick={() => changeSection('starred')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all ${section === 'starred' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <Star className={`w-5 h-5 ${section === 'starred' ? 'text-blue-600' : 'text-gray-400'}`} /> Starred
          </button>
          <button 
            onClick={() => changeSection('trash')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all ${section === 'trash' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <Trash2 className={`w-5 h-5 ${section === 'trash' ? 'text-blue-600' : 'text-gray-400'}`} /> Trash
          </button>
        </div>

        <div className="p-4 border-t border-gray-100 space-y-1">
          <button onClick={() => {
             document.cookie = 'token=; Max-Age=0; path=/';
             router.push('/login');
          }} className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg font-medium transition-colors">
            <LogOut className="w-5 h-5 text-gray-400" /> Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* HEADER */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-6 z-10 sticky top-0">
          <div className="relative w-full max-w-xl">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search in Drive..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 border border-transparent rounded-full py-2 pl-10 pr-4 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-900 leading-tight">{user?.name || "Loading..."}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-full flex items-center justify-center shadow-md text-white font-bold text-lg">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
          </div>
        </header>

        {/* DRIVE CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 relative">
          
          {/* TOP BAR: Breadcrumbs & Actions */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 text-xl font-semibold text-gray-800 flex-wrap">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.id || 'root'}>
                  <span 
                    onClick={() => navigateToBreadcrumb(idx)}
                    className={`cursor-pointer hover:text-blue-600 transition-colors ${idx === breadcrumbs.length - 1 ? 'text-gray-900' : 'text-gray-500'}`}
                  >
                    {crumb.name}
                  </span>
                  {idx < breadcrumbs.length - 1 && <ChevronRight className="w-5 h-5 text-gray-400" />}
                </React.Fragment>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-gray-100 p-1 rounded-lg flex items-center gap-1 mr-4 border border-gray-200">
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  <List className="w-5 h-5" />
                </button>
              </div>

              {section === "mydrive" && (
                <>
                  <button 
                    onClick={() => setIsCreateFolderModalOpen(true)}
                    className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium transition-colors shadow-sm text-sm"
                  >
                    <Plus className="w-4 h-4" /> New Folder
                  </button>
                  
                  <label className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium transition-colors cursor-pointer shadow-sm shadow-blue-600/20 text-sm">
                    <Upload className="w-4 h-4" /> Upload File
                    <input type="file" className="hidden" onChange={handleFileUpload} />
                  </label>
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* FOLDERS SECTION */}
              {filteredFolders.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Folders</h2>
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {filteredFolders.map((folder) => (
                        <div key={`folder-${folder.id}`} className="group relative bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex items-center justify-between">
                          <div className="flex items-center gap-3 overflow-hidden flex-1" onClick={() => navigateToFolder(folder)}>
                            <FolderIcon className="w-8 h-8 text-blue-500 fill-blue-500/20 flex-shrink-0" />
                            <span className="font-medium text-gray-800 text-sm truncate select-none">{folder.name}</span>
                          </div>
                          
                          {folder.isStarred && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 absolute top-2 right-2" />}

                          <button onClick={(e) => { e.stopPropagation(); setActiveDropdown({ type: 'folder', id: folder.id }); }} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeDropdown?.type === 'folder' && activeDropdown.id === folder.id && (
                            <div ref={dropdownRef} className="absolute right-0 top-12 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                              {section !== 'trash' ? (
                                <>
                                  <button onClick={(e) => { e.stopPropagation(); openRenameModal('folder', folder.id, folder.name); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                    <Edit2 className="w-4 h-4" /> Rename
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleUpdateItem('folder', folder.id, { isStarred: !folder.isStarred }); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                    <Star className="w-4 h-4" /> {folder.isStarred ? 'Unstar' : 'Add to Starred'}
                                  </button>
                                  <div className="h-px bg-gray-100 my-1"></div>
                                  <button onClick={(e) => { e.stopPropagation(); handleUpdateItem('folder', folder.id, { isDeleted: true }); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4" /> Move to Trash
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={(e) => { e.stopPropagation(); handleUpdateItem('folder', folder.id, { isDeleted: false }); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50">
                                    <RotateCcw className="w-4 h-4" /> Restore
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeletePermanently('folder', folder.id); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4" /> Delete Permanently
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      {filteredFolders.map((folder) => (
                        <div key={`folder-list-${folder.id}`} className="group relative flex items-center justify-between p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigateToFolder(folder)}>
                          <div className="flex items-center gap-4 flex-1">
                            <FolderIcon className="w-6 h-6 text-blue-500 fill-blue-500/20" />
                            <span className="font-medium text-gray-800 text-sm">{folder.name}</span>
                            {folder.isStarred && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-gray-400 hidden md:block">Folder</span>
                            <div className="relative">
                              <button onClick={(e) => { e.stopPropagation(); setActiveDropdown({ type: 'folder', id: folder.id }); }} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {activeDropdown?.type === 'folder' && activeDropdown.id === folder.id && (
                                <div ref={dropdownRef} className="absolute right-0 top-10 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 text-left">
                                  {section !== 'trash' ? (
                                    <>
                                      <div onClick={(e) => { e.stopPropagation(); openRenameModal('folder', folder.id, folder.name); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                        <Edit2 className="w-4 h-4" /> Rename
                                      </div>
                                      <div onClick={(e) => { e.stopPropagation(); handleUpdateItem('folder', folder.id, { isStarred: !folder.isStarred }); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                        <Star className="w-4 h-4" /> {folder.isStarred ? 'Unstar' : 'Add to Starred'}
                                      </div>
                                      <div onClick={(e) => { e.stopPropagation(); handleUpdateItem('folder', folder.id, { isDeleted: true }); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                        <Trash2 className="w-4 h-4" /> Move to Trash
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div onClick={(e) => { e.stopPropagation(); handleUpdateItem('folder', folder.id, { isDeleted: false }); }} className="flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50">
                                        <RotateCcw className="w-4 h-4" /> Restore
                                      </div>
                                      <div onClick={(e) => { e.stopPropagation(); handleDeletePermanently('folder', folder.id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                        <Trash2 className="w-4 h-4" /> Delete Permanently
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* FILES SECTION */}
              {filteredFiles.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Files</h2>
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {filteredFiles.map((file) => (
                        <div key={`file-${file.id}`} className="group relative bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all">
                          <div onClick={(e) => handleOpenFile(e, file.id)} className="flex flex-col gap-3 h-full cursor-pointer">
                            <div className="h-28 bg-indigo-50/50 rounded-lg flex items-center justify-center mb-1 overflow-hidden relative">
                              <FileIcon className="w-10 h-10 text-indigo-400" />
                              {file.isStarred && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 absolute top-2 right-2" />}
                            </div>
                            <div className="flex items-start justify-between">
                              <div className="flex flex-col overflow-hidden w-full">
                                <span className="font-medium text-sm text-gray-800 truncate" title={file.name}>{file.name}</span>
                                <span className="text-xs text-gray-400 mt-0.5">{formatSize(file.size)}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="absolute top-2 right-2">
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveDropdown({ type: 'file', id: file.id }); }} className="p-1.5 text-gray-600 bg-white/90 shadow-sm hover:text-gray-900 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {activeDropdown?.type === 'file' && activeDropdown.id === file.id && (
                                <div ref={dropdownRef} className="absolute right-0 top-8 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1">
                                  <button onClick={(e) => { setActiveDropdown(null); handleOpenFile(e, file.id); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                    <Download className="w-4 h-4" /> Download / View
                                  </button>
                                  {section !== 'trash' ? (
                                    <>
                                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openRenameModal('file', file.id, file.name); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                        <Edit2 className="w-4 h-4" /> Rename
                                      </button>
                                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUpdateItem('file', file.id, { isStarred: !file.isStarred }); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                        <Star className="w-4 h-4" /> {file.isStarred ? 'Unstar' : 'Add to Starred'}
                                      </button>
                                      <div className="h-px bg-gray-100 my-1"></div>
                                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUpdateItem('file', file.id, { isDeleted: true }); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                        <Trash2 className="w-4 h-4" /> Move to Trash
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <div className="h-px bg-gray-100 my-1"></div>
                                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUpdateItem('file', file.id, { isDeleted: false }); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50">
                                        <RotateCcw className="w-4 h-4" /> Restore
                                      </button>
                                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeletePermanently('file', file.id); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                        <Trash2 className="w-4 h-4" /> Delete Permanently
                                      </button>
                                    </>
                                  )}
                                </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      {filteredFiles.map((file) => (
                        <div key={`file-list-${file.id}`} className="group relative flex items-center justify-between p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                          <div onClick={(e) => handleOpenFile(e, file.id)} className="flex items-center gap-4 flex-1 cursor-pointer">
                            <FileIcon className="w-5 h-5 text-indigo-400" />
                            <span className="font-medium text-gray-800 text-sm">{file.name}</span>
                            {file.isStarred && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                          </div>
                          <div className="flex items-center gap-8">
                            <span className="text-xs text-gray-400 hidden md:block w-20 text-right">{formatSize(file.size)}</span>
                            <div className="relative">
                              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveDropdown({ type: 'file', id: file.id }); }} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {activeDropdown?.type === 'file' && activeDropdown.id === file.id && (
                                <div ref={dropdownRef} className="absolute right-0 top-10 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 text-left">
                                  <div onClick={(e) => { setActiveDropdown(null); handleOpenFile(e, file.id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                                    <Download className="w-4 h-4" /> Download / View
                                  </div>
                                  {section !== 'trash' ? (
                                    <>
                                      <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); openRenameModal('file', file.id, file.name); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                                        <Edit2 className="w-4 h-4" /> Rename
                                      </div>
                                      <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUpdateItem('file', file.id, { isStarred: !file.isStarred }); }} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                                        <Star className="w-4 h-4" /> {file.isStarred ? 'Unstar' : 'Add to Starred'}
                                      </div>
                                      <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUpdateItem('file', file.id, { isDeleted: true }); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer">
                                        <Trash2 className="w-4 h-4" /> Move to Trash
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUpdateItem('file', file.id, { isDeleted: false }); }} className="flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50 cursor-pointer">
                                        <RotateCcw className="w-4 h-4" /> Restore
                                      </div>
                                      <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeletePermanently('file', file.id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer">
                                        <Trash2 className="w-4 h-4" /> Delete Permanently
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* EMPTY STATE */}
              {folders.length === 0 && files.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center mt-10">
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    {section === 'trash' ? (
                      <Trash2 className="w-10 h-10 text-gray-400" />
                    ) : section === 'starred' ? (
                      <Star className="w-10 h-10 text-gray-400" />
                    ) : (
                      <HardDrive className="w-10 h-10 text-gray-400" />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {section === 'trash' ? 'Trash is empty' : section === 'starred' ? 'No starred items' : 'This folder is empty'}
                  </h3>
                  <p className="text-gray-500 mb-6 text-sm">
                    {section === 'mydrive' && "Drag and drop files here, or use the buttons above to add content."}
                  </p>
                  
                  {section === 'mydrive' && (
                    <label className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium transition-colors cursor-pointer shadow-sm text-sm">
                      <Upload className="w-4 h-4" /> Upload File
                      <input type="file" className="hidden" onChange={handleFileUpload} />
                    </label>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* MODALS */}
      
      {/* Create Folder Modal */}
      {isCreateFolderModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">New Folder</h3>
              <button onClick={() => setIsCreateFolderModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateFolder} className="p-6">
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all mb-6 text-sm"
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsCreateFolderModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={!newFolderName.trim()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Rename {renameTarget?.type}</h3>
              <button onClick={() => setIsRenameModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRename} className="p-6">
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="New name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all mb-6 text-sm"
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsRenameModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={!newFolderName.trim() || newFolderName === renameTarget?.currentName} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
