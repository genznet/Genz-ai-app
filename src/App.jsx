import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Search, 
  Shirt, 
  Scissors, 
  Wand2, 
  ZoomIn, 
  X, 
  History, 
  Loader2,
  CheckCircle2,
  Camera,
  ImagePlus,
  Trash2,
  Moon,
  Sun,
  Download,
  Lock,
  User,
  Key,
  LogOut,
  ArrowRight,
  UserPlus, 
  Mail, 
  Instagram,
  Eye,    
  EyeOff  
} from 'lucide-react';

// --- API UTILITIES ---

const API_KEY = "AIzaSyC5qrQD-kXfTLkC22po9zkzIuTdiUWpues"; // System injects this

// Helper for Imagen 3 (Used for "Searching"/Generating Clothing Mockups)
const generateClothingMockup = async (prompt) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${API_KEY}`;
  
  const finalPrompt = `Professional product photography of ${prompt}, isolated on plain white background, high quality, realistic texture, fashion catalog style.`;

  const payload = {
    instances: [{ prompt: finalPrompt }],
    parameters: { sampleCount: 1 }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (data.predictions && data.predictions[0]?.bytesBase64Encoded) {
      return `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
    }
    throw new Error("Gagal membuat mockup pakaian.");
  } catch (error) {
    console.error(error);
    return null;
  }
};

// Helper for Gemini Image Editing (Used for the actual Try-On)
const generateTryOn = async (userImageBase64, referenceImageBase64, options) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${API_KEY}`;
  
  let promptText = "";
  const parts = [];

  if (referenceImageBase64) {
    promptText += "You are a highly accurate virtual try-on assistant. ";
    promptText += "There are two images provided. The FIRST image is the USER (person). The SECOND image is the REFERENCE OUTFIT. ";
    promptText += "YOUR TASK: Dress the user in the first image exactly like the reference outfit in the second image. ";
    promptText += "STRICT REQUIREMENTS: ";
    promptText += "- Match the exact color, pattern, fabric texture, cut, and stitching details from the reference outfit. ";
    promptText += "- The clothing must blend naturally with the body, maintaining realistic human proportions. ";
    promptText += "- High photo quality and sharp details. ";
    promptText += "NEGATIVE CONSTRAINTS (DO NOT IGNORE): ";
    promptText += "- DO NOT change the color of the outfit. ";
    promptText += "- DO NOT change the design or model of the clothing. ";
    promptText += "- DO NOT add new accessories that are not in the reference. ";
    promptText += "- DO NOT re-interpret the outfit; copy it visually. ";
  } else {
    promptText += "Change the clothing of the person in the image. ";
  }

  if (options.hijab) {
    promptText += "The person should be wearing a stylish hijab that matches the outfit. ";
  } else {
    promptText += "The person is NOT wearing a hijab (unless already present). ";
  }

  if (!referenceImageBase64) {
    if (options.topPrompt) {
        promptText += `Upper body clothing: ${options.topPrompt}. Ensure texture matches. `;
    }
    if (options.bottomPrompt) {
        promptText += `Lower body clothing: ${options.bottomPrompt}. Ensure fit is realistic. `;
    }
  } else {
    if (options.extraPrompt) {
        promptText += `Additional context: ${options.extraPrompt}. `;
    }
  }
  
  if (!referenceImageBase64 && options.extraPrompt) {
      promptText += `Additional details: ${options.extraPrompt}. `;
  }

  promptText += "Maintain the person's exact face, identity, body pose, skin tone, and background from the user image. Only change the requested garments. Photorealistic, 8k quality, natural lighting.";

  parts.push({ text: promptText });

  const getMimeType = (dataUrl) => dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';'));
  const getBase64Data = (dataUrl) => dataUrl.split(',')[1];

  parts.push({
    inlineData: {
      mimeType: getMimeType(userImageBase64),
      data: getBase64Data(userImageBase64)
    }
  });

  if (referenceImageBase64) {
    parts.push({
      inlineData: {
        mimeType: getMimeType(referenceImageBase64),
        data: getBase64Data(referenceImageBase64)
      }
    });
  }

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["IMAGE"]
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    const resultBase64 = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    
    if (resultBase64) {
      return `data:image/png;base64,${resultBase64}`;
    }
    throw new Error("Gagal memproses try-on.");
  } catch (error) {
    console.error(error);
    throw error;
  }
};


// --- COMPONENTS ---

const ImageCard = ({ src, selected, onClick, label, isDarkMode }) => (
  <div 
    onClick={onClick}
    className={`relative group cursor-pointer rounded-xl overflow-hidden aspect-square border-2 transition-all duration-200 
      ${selected 
        ? 'border-purple-600 ring-2 ring-purple-200 shadow-lg' 
        : isDarkMode ? 'border-slate-700 hover:border-purple-400' : 'border-gray-200 hover:border-purple-300'
      }`}
  >
    <img src={src} alt={label} className="w-full h-full object-cover" />
    {selected && (
      <div className="absolute top-2 right-2 bg-purple-600 text-white p-1 rounded-full shadow-md">
        <CheckCircle2 size={16} />
      </div>
    )}
    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
    <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate text-center backdrop-blur-sm">
      {label}
    </p>
  </div>
);

export default function VirtualTryOnApp() {
  // Auth State
  const [users, setUsers] = useState([
    { username: 'genz', password: '1234', contact: 'admin@genz.ai' }
  ]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoginView, setIsLoginView] = useState(true); 
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); 
  const [contact, setContact] = useState(""); 
  const [rememberMe, setRememberMe] = useState(false); 
  const [loginError, setLoginError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // App State
  const [isDarkMode, setIsDarkMode] = useState(true); 
  const [userImage, setUserImage] = useState(null);
  const [referenceImage, setReferenceImage] = useState(null); 
  const [hijab, setHijab] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState("");
  
  // Search States
  const [topSearch, setTopSearch] = useState("");
  const [topResults, setTopResults] = useState([]);
  const [selectedTop, setSelectedTop] = useState(null);
  const [isSearchingTop, setIsSearchingTop] = useState(false);

  const [bottomSearch, setBottomSearch] = useState("");
  const [bottomResults, setBottomResults] = useState([]);
  const [selectedBottom, setSelectedBottom] = useState(null);
  const [isSearchingBottom, setIsSearchingBottom] = useState(false);

  // Generation States
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [zoomImage, setZoomImage] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const fileInputRef = useRef(null);
  const fileInputRefReference = useRef(null); 

  // Theme Classes Helpers
  const t = {
    bg: isDarkMode ? 'bg-slate-950' : 'bg-slate-50',
    text: isDarkMode ? 'text-slate-100' : 'text-slate-900',
    cardBg: isDarkMode ? 'bg-slate-900' : 'bg-white',
    cardBorder: isDarkMode ? 'border-slate-800' : 'border-slate-100',
    inputBg: isDarkMode ? 'bg-slate-800' : 'bg-white',
    inputBorder: isDarkMode ? 'border-slate-700' : 'border-slate-200',
    subText: isDarkMode ? 'text-slate-400' : 'text-slate-500',
    dashedBorder: isDarkMode ? 'border-slate-700' : 'border-slate-300',
    hoverBg: isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50',
    divider: isDarkMode ? 'bg-slate-800' : 'bg-slate-200',
    iconBg: isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
  };

  // Load saved credentials on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('genz_username');
    const savedPass = localStorage.getItem('genz_password');
    if (savedUser && savedPass) {
      setUsername(savedUser);
      setPassword(savedPass);
      setRememberMe(true);
    }
  }, []);

  // Handlers
  const handleLogin = (e) => {
    e.preventDefault();
    setSuccessMsg("");
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    
    if (user) {
      setIsAuthenticated(true);
      setLoginError("");

      if (rememberMe) {
        localStorage.setItem('genz_username', username);
        localStorage.setItem('genz_password', password);
      } else {
        localStorage.removeItem('genz_username');
        localStorage.removeItem('genz_password');
      }

    } else {
      setLoginError("Username atau password salah!");
    }
  };

  const handleSignup = (e) => {
    e.preventDefault();
    setLoginError("");
    setSuccessMsg("");

    if (!username.trim() || !password.trim() || !contact.trim()) {
      setLoginError("Semua kolom wajib diisi.");
      return;
    }

    if (username.length < 3) {
      setLoginError("Username minimal 3 karakter.");
      return;
    }

    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      setLoginError("Username sudah terdaftar. Gunakan yang lain.");
      return;
    }

    const newUser = { username, password, contact };
    setUsers([...users, newUser]);
    setIsLoginView(true);
    setSuccessMsg("Pendaftaran berhasil! Silakan login.");
    
    // Clear inputs after successful signup
    setUsername("");
    setPassword("");
    setContact("");
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserImage(null);
    setHistory([]);
    setContact("");
    setSuccessMsg("");
    setLoginError("");
    setIsLoginView(true);

    const savedUser = localStorage.getItem('genz_username');
    const savedPass = localStorage.getItem('genz_password');
    
    if (savedUser && savedPass) {
      setUsername(savedUser);
      setPassword(savedPass);
      setRememberMe(true);
    } else {
      setUsername("");
      setPassword("");
      setRememberMe(false);
    }
  };

  const handleDownload = () => {
    if (!currentResult) return;
    const link = document.createElement('a');
    link.href = currentResult;
    link.download = `genz-result-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUserImage(e.target.result);
        setCurrentResult(null); 
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReferenceUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setReferenceImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSearch = async (type) => {
    const isTop = type === 'top';
    const query = isTop ? topSearch : bottomSearch;
    const setResults = isTop ? setTopResults : setBottomResults;
    const setLoading = isTop ? setIsSearchingTop : setIsSearchingBottom;

    if (!query.trim()) return;

    setLoading(true);
    try {
      const promises = [1, 2, 3].map(() => generateClothingMockup(query));
      const results = await Promise.all(promises);
      
      const validResults = results.filter(r => r !== null).map((src, idx) => ({
        id: Date.now() + idx,
        src,
        label: query
      }));
      
      setResults(validResults);
    } catch (err) {
      setErrorMsg("Gagal mencari pakaian. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTryOn = async () => {
    if (!userImage) {
      setErrorMsg("Harap upload foto Anda terlebih dahulu.");
      return;
    }
    if (!referenceImage && !selectedTop && !selectedBottom && !extraPrompt) {
      setErrorMsg("Harap upload foto referensi, pilih pakaian, atau masukkan deskripsi.");
      return;
    }

    setIsGenerating(true);
    setErrorMsg("");

    try {
      const options = {
        hijab,
        topPrompt: selectedTop ? selectedTop.label : "",
        bottomPrompt: selectedBottom ? selectedBottom.label : "",
        extraPrompt
      };

      const resultImage = await generateTryOn(userImage, referenceImage, options);
      
      setCurrentResult(resultImage);
      setHistory(prev => [resultImage, ...prev]);
    } catch (err) {
      setErrorMsg("Gagal melakukan try-on. Pastikan foto jelas.");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- LOGIN / SIGNUP VIEW ---
  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen font-sans flex items-center justify-center p-4 transition-colors duration-300 ${t.bg} ${t.text}`}>
        <div className={`w-full max-w-md ${t.cardBg} rounded-2xl shadow-xl border ${t.cardBorder} p-8 animate-in fade-in slide-in-from-bottom-4 duration-500`}>
          
          <div className="flex justify-end mb-4">
             <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-2 rounded-full transition-all ${isDarkMode ? 'bg-slate-800 text-yellow-400' : 'bg-slate-100 text-slate-600'}`}
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
          </div>

          <div className="text-center mb-8">
            <div className="bg-purple-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg shadow-purple-500/30">
              <Lock size={32} />
            </div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600 mb-2">
              Genz AI Virtual
            </h1>
            <p className={`text-sm ${t.subText}`}>
              {isLoginView ? "Silakan login untuk akses fitur Try-On" : "Buat akun baru untuk memulai"}
            </p>
          </div>

          <form onSubmit={isLoginView ? handleLogin : handleSignup} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${t.subText}`}>Username</label>
              <div className="relative">
                <User className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.subText}`} size={18} />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors ${t.inputBg} ${t.inputBorder} ${t.text}`}
                  placeholder="Masukkan username"
                />
              </div>
            </div>

            {/* Email/Phone Input - Only for Signup */}
            {!isLoginView && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className={`block text-sm font-medium mb-1 ${t.subText}`}>Email / No. HP</label>
                <div className="relative">
                  <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.subText}`} size={18} />
                  <input 
                    type="text" 
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors ${t.inputBg} ${t.inputBorder} ${t.text}`}
                    placeholder="Masukkan email atau no. hp"
                  />
                </div>
              </div>
            )}

            <div>
              <label className={`block text-sm font-medium mb-1 ${t.subText}`}>Password</label>
              <div className="relative">
                <Key className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.subText}`} size={18} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full pl-10 pr-10 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors ${t.inputBg} ${t.inputBorder} ${t.text}`}
                  placeholder="Masukkan password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${t.subText} hover:text-purple-600 transition-colors focus:outline-none`}
                  title={showPassword ? "Sembunyikan Password" : "Tampilkan Password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox - Only for Login */}
            {isLoginView && (
              <div className="flex items-center gap-2">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    id="remember" 
                    checked={rememberMe} 
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-slate-500 checked:bg-purple-600 checked:border-purple-600 focus:ring-2 focus:ring-purple-500/30 transition-all"
                  />
                  <CheckCircle2 size={12} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
                </div>
                <label htmlFor="remember" className={`text-sm cursor-pointer select-none ${t.subText}`}>
                  Ingat Login
                </label>
              </div>
            )}

            {loginError && (
              <div className={`p-3 text-sm rounded-lg text-center ${isDarkMode ? 'bg-red-900/20 text-red-300' : 'bg-red-50 text-red-600'}`}>
                {loginError}
              </div>
            )}

            {successMsg && (
              <div className={`p-3 text-sm rounded-lg text-center ${isDarkMode ? 'bg-green-900/20 text-green-300' : 'bg-green-50 text-green-600'}`}>
                {successMsg}
              </div>
            )}

            <button 
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2"
            >
              {isLoginView ? (
                <>Masuk Aplikasi <ArrowRight size={18} /></>
              ) : (
                <>Daftar Akun <UserPlus size={18} /></>
              )}
            </button>
            
            <div className="text-center pt-2">
              <button 
                type="button"
                onClick={() => {
                  setIsLoginView(!isLoginView);
                  setLoginError("");
                  setSuccessMsg("");
                  setUsername("");
                  setPassword("");
                  setContact("");
                  setShowPassword(false); 
                }}
                className={`text-sm font-medium hover:underline ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}
              >
                {isLoginView ? "Belum punya akun? Daftar Sekarang" : "Sudah punya akun? Login Di sini"}
              </button>
            </div>

            {/* Instagram Handle Footer */}
            <div className={`text-center mt-6 pt-4 border-t ${t.dashedBorder} flex items-center justify-center gap-2 text-sm ${t.subText}`}>
              <Instagram size={16} className="text-purple-500" />
              <span className="font-medium tracking-wide opacity-80">@ge.ntaa</span>
            </div>

          </form>
        </div>
      </div>
    );
  }

  // --- MAIN APP VIEW ---
  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 pb-20 ${t.bg} ${t.text}`}>
      {/* Header */}
      <header className={`${t.cardBg} border-b ${t.cardBorder} sticky top-0 z-10 transition-colors duration-300`}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-purple-600 p-2 rounded-lg text-white">
              <Wand2 size={24} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600">
              Genz AI Virtual
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className={`text-sm hidden sm:block ${t.subText}`}>
              Halo, {username}
            </div>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-full transition-all ${isDarkMode ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button 
              onClick={handleLogout}
              className={`p-2 rounded-full transition-all text-red-500 hover:bg-red-50 ${isDarkMode ? 'hover:bg-red-900/20' : ''}`}
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Controls & Selection */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* 1. Upload User Photo */}
          <div className={`${t.cardBg} p-6 rounded-2xl shadow-sm border ${t.cardBorder} transition-colors duration-300`}>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Camera className="text-purple-600" size={20}/> 1. Upload Foto Anda
            </h2>
            <div 
              onClick={() => fileInputRef.current.click()}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all aspect-[4/3] overflow-hidden relative ${t.dashedBorder} ${t.hoverBg}`}
            >
              {userImage ? (
                <img src={userImage} alt="User" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <>
                  <Upload size={32} className={`mb-2 ${t.subText}`} />
                  <p className="text-sm font-medium">Klik untuk upload foto diri</p>
                  <p className={`text-xs mt-1 ${t.subText}`}>Full body atau setengah badan</p>
                </>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          </div>

          {/* 2. Choose Outfit Source */}
          <div className={`${t.cardBg} p-6 rounded-2xl shadow-sm border ${t.cardBorder} space-y-6 transition-colors duration-300`}>
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Shirt className="text-purple-600" size={20}/> 2. Pilih Pakaian
              </h2>
              <label className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-full text-sm transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'}`}>
                <input 
                  type="checkbox" 
                  checked={hijab} 
                  onChange={(e) => setHijab(e.target.checked)} 
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span>Mode Hijab</span>
              </label>
            </div>

            {/* TAB: Reference Image */}
            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-purple-900/20 border-purple-900/50' : 'bg-purple-50 border-purple-100'}`}>
                <div className="flex items-center justify-between mb-2">
                    <label className={`text-sm font-bold flex items-center gap-2 ${isDarkMode ? 'text-purple-300' : 'text-purple-900'}`}>
                        <ImagePlus size={16}/> Upload Referensi Outfit
                    </label>
                    {referenceImage && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setReferenceImage(null); }}
                            className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                        >
                            <Trash2 size={12}/> Hapus
                        </button>
                    )}
                </div>
                
                <div 
                    onClick={() => fileInputRefReference.current.click()}
                    className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${referenceImage ? 'border-purple-400 bg-transparent' : `${isDarkMode ? 'border-purple-800 hover:bg-slate-800' : 'border-purple-200 hover:bg-white'}`}`}
                >
                    {referenceImage ? (
                        <div className="relative w-full h-48">
                             <img src={referenceImage} alt="Reference" className="w-full h-full object-contain rounded" />
                             <div className="absolute bottom-0 left-0 right-0 bg-purple-600 text-white text-xs py-1 opacity-90">
                                Gambar Referensi Aktif
                             </div>
                        </div>
                    ) : (
                        <div className={`py-4 ${isDarkMode ? 'text-purple-300/60' : 'text-purple-800/60'}`}>
                            <p className="text-sm font-medium">Upload foto baju yang ingin dicoba</p>
                            <p className="text-xs mt-1">Kami akan mencocokkan warna & tekstur secara akurat</p>
                        </div>
                    )}
                     <input 
                        type="file" 
                        ref={fileInputRefReference} 
                        onChange={handleReferenceUpload} 
                        accept="image/*" 
                        className="hidden" 
                    />
                </div>
            </div>

            <div className="flex items-center gap-2 my-2">
                <div className={`h-px flex-1 ${t.divider}`}></div>
                <span className={`text-xs uppercase font-medium ${t.subText}`}>Atau Cari Manual</span>
                <div className={`h-px flex-1 ${t.divider}`}></div>
            </div>

            {/* Manual Search Options */}
            <div className={`space-y-6 transition-opacity duration-300 ${referenceImage ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
                {/* Top Search */}
                <div>
                <label className={`text-sm font-medium mb-2 block ${t.subText}`}>Cari Atasan (Tops)</label>
                <div className="flex gap-2 mb-3">
                    <input 
                    type="text" 
                    placeholder="Contoh: Kemeja flanel merah..." 
                    className={`flex-1 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${t.inputBg} ${t.inputBorder} ${t.text}`}
                    value={topSearch}
                    onChange={(e) => setTopSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch('top')}
                    />
                    <button 
                    onClick={() => handleSearch('top')}
                    disabled={isSearchingTop}
                    className={`text-white p-2 rounded-lg disabled:opacity-50 transition-colors ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-900 hover:bg-slate-800'}`}
                    >
                    {isSearchingTop ? <Loader2 className="animate-spin" size={20}/> : <Search size={20}/>}
                    </button>
                </div>
                
                {/* Top Results */}
                {topResults.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                    {topResults.map(item => (
                        <ImageCard 
                        key={item.id} 
                        src={item.src} 
                        label={item.label}
                        isDarkMode={isDarkMode}
                        selected={selectedTop?.id === item.id}
                        onClick={() => setSelectedTop(selectedTop?.id === item.id ? null : item)}
                        />
                    ))}
                    </div>
                )}
                </div>

                {/* Bottom Search */}
                <div>
                <label className={`text-sm font-medium mb-2 block ${t.subText}`}>Cari Bawahan (Bottoms)</label>
                <div className="flex gap-2 mb-3">
                    <input 
                    type="text" 
                    placeholder="Contoh: Jeans biru sobek..." 
                    className={`flex-1 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${t.inputBg} ${t.inputBorder} ${t.text}`}
                    value={bottomSearch}
                    onChange={(e) => setBottomSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch('bottom')}
                    />
                    <button 
                    onClick={() => handleSearch('bottom')}
                    disabled={isSearchingBottom}
                    className={`text-white p-2 rounded-lg disabled:opacity-50 transition-colors ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-900 hover:bg-slate-800'}`}
                    >
                    {isSearchingBottom ? <Loader2 className="animate-spin" size={20}/> : <Search size={20}/>}
                    </button>
                </div>

                {/* Bottom Results */}
                {bottomResults.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                    {bottomResults.map(item => (
                        <ImageCard 
                        key={item.id} 
                        src={item.src} 
                        label={item.label}
                        isDarkMode={isDarkMode}
                        selected={selectedBottom?.id === item.id}
                        onClick={() => setSelectedBottom(selectedBottom?.id === item.id ? null : item)}
                        />
                    ))}
                    </div>
                )}
                </div>
            </div>

            {/* Extra Prompt */}
            <div>
              <label className={`text-sm font-medium mb-2 block ${t.subText}`}>Detail Tambahan (Opsional)</label>
              <textarea 
                placeholder="Misal: Tambahkan kacamata hitam, latar belakang taman..."
                className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500/50 h-20 text-sm resize-none ${t.inputBg} ${t.inputBorder} ${t.text}`}
                value={extraPrompt}
                onChange={(e) => setExtraPrompt(e.target.value)}
              />
            </div>

          </div>

          {/* Generate Action */}
          <button 
            onClick={handleGenerateTryOn}
            disabled={isGenerating || !userImage}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-purple-200 hover:shadow-purple-300 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="animate-spin" /> Sedang Mengedit...
              </>
            ) : (
              <>
                <Wand2 /> Mulai Try-On
              </>
            )}
          </button>
          
          {errorMsg && (
            <div className={`p-3 text-sm rounded-lg border animate-in fade-in slide-in-from-top-2 ${isDarkMode ? 'bg-red-900/20 text-red-300 border-red-800' : 'bg-red-50 text-red-600 border-red-100'}`}>
              {errorMsg}
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Results */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Main Result */}
          <div className={`${t.cardBg} p-6 rounded-2xl shadow-sm border ${t.cardBorder} min-h-[500px] flex flex-col transition-colors duration-300`}>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <CheckCircle2 className="text-green-500" size={20}/> Hasil Try-On
            </h2>
            
            <div className={`flex-1 rounded-xl border overflow-hidden relative flex items-center justify-center group ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              {currentResult ? (
                <>
                  <img src={currentResult} alt="Result" className="w-full h-full object-contain max-h-[600px]" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                    <button 
                      onClick={() => setZoomImage(currentResult)}
                      className="bg-white text-slate-900 px-4 py-2 rounded-full font-medium shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all flex items-center gap-2 hover:bg-gray-100"
                    >
                      <ZoomIn size={18}/> Perbesar
                    </button>
                    <button 
                      onClick={handleDownload}
                      className="bg-purple-600 text-white px-4 py-2 rounded-full font-medium shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all flex items-center gap-2 hover:bg-purple-700"
                    >
                      <Download size={18}/> Simpan
                    </button>
                  </div>
                </>
              ) : (
                <div className={`text-center p-8 ${t.subText}`}>
                  {isGenerating ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <div className={`w-16 h-16 border-4 border-t-purple-600 rounded-full animate-spin ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Scissors size={20} className="text-purple-600"/>
                        </div>
                      </div>
                      <p>AI sedang memproses foto Anda...</p>
                      <p className="text-xs max-w-xs mx-auto opacity-70">Kami menyesuaikan ukuran, pencahayaan, dan tekstur pakaian agar terlihat nyata.</p>
                    </div>
                  ) : (
                    <>
                      <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <Shirt size={40} className="opacity-20"/>
                      </div>
                      <p>Hasil generate akan muncul di sini</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className={`${t.cardBg} p-6 rounded-2xl shadow-sm border ${t.cardBorder} transition-colors duration-300`}>
              <h2 className={`font-semibold text-lg mb-4 flex items-center gap-2 ${t.subText}`}>
                <History size={20}/> Riwayat
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {history.map((img, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => { setCurrentResult(img); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className={`flex-shrink-0 w-24 h-32 rounded-lg overflow-hidden border cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all ${t.cardBorder}`}
                  >
                    <img src={img} alt="History" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Zoom Modal */}
      {zoomImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200">
          <button 
            onClick={() => setZoomImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 bg-white/10 p-2 rounded-full backdrop-blur-sm transition-colors"
          >
            <X size={24} />
          </button>
          <img 
            src={zoomImage} 
            alt="Zoom" 
            className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl" 
          />
        </div>
      )}

    </div>
  );

}
