import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, X, Edit2, Trash2, Shield, ShieldAlert, 
  AlertTriangle, Filter, ChevronLeft, ChevronRight, 
  Images, Presentation, CheckCircle2, Globe, Maximize2, Play
} from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth, googleProvider } from './firebase';

export default function App() {
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  // Trạng thái hiển thị Iframe trong modal
  const [showIframe, setShowIframe] = useState(false);
  
  // Trạng thái bộ lọc
  const [filterBrand, setFilterBrand] = useState('All');
  const [filterDevice, setFilterDevice] = useState('All');

  // Trạng thái Form (Thêm/Sửa)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ 
    title: '', icon: '🎮', rules: '', link: '', brand: '', device: '', slides: [], slideshowUrl: '' 
  });

  // Trạng thái Fullscreen Slide
  const [isFullscreenSlideOpen, setIsFullscreenSlideOpen] = useState(false);

  // Trạng thái Xóa & Gallery
  const [gameToDelete, setGameToDelete] = useState(null);
  const [slideModalGame, setSlideModalGame] = useState(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Trạng thái Lỗi Đăng Nhập
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Lắng nghe trạng thái đăng nhập
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Kiểm tra email hardcoded
        const isAdminEmail = user.email === 'nhanntl18402@gmail.com' && user.emailVerified;
        if (isAdminEmail) {
          setIsAdmin(true);
        } else {
          // Kiểm tra role trong Firestore collection users
          try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            setIsAdmin(userDoc.exists() && userDoc.data()?.role === 'admin');
          } catch {
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Lấy dữ liệu từ Firestore
  useEffect(() => {
    if (!isAuthReady) return;
    
    const q = query(collection(db, 'games'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gamesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setGames(gamesData);
    }, (error) => {
      console.error("Lỗi khi tải dữ liệu:", error);
    });

    return () => unsubscribe();
  }, [isAuthReady]);

  // Reset trạng thái Iframe khi đóng modal hoặc đổi game
  useEffect(() => {
    if (!selectedGame) {
      setShowIframe(false);
    }
  }, [selectedGame]);

  // Lắng nghe phím ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsFullscreenSlideOpen(false);
        setSelectedGame(null);
        setIsFormModalOpen(false);
        setSlideModalGame(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const uniqueBrands = useMemo(() => ['All', ...Array.from(new Set(games.map(g => g.brand).filter(Boolean)))], [games]);
  const uniqueDevices = useMemo(() => ['All', ...Array.from(new Set(games.map(g => g.device).filter(Boolean)))], [games]);

  const filteredGames = useMemo(() => {
    return games.filter(g => {
      const matchBrand = filterBrand === 'All' || g.brand === filterBrand;
      const matchDevice = filterDevice === 'All' || g.device === filterDevice;
      return matchBrand && matchDevice;
    });
  }, [games, filterBrand, filterDevice]);

  const openAddModal = () => {
    setFormData({ title: '', icon: '🎮', rules: '', link: '', brand: '', device: '', slides: [], slideshowUrl: '' });
    setEditingId(null);
    setIsFormModalOpen(true);
  };

  const openEditModal = (game) => {
    setFormData({ 
      title: game.title, 
      icon: game.icon, 
      rules: game.rules, 
      link: game.link, 
      brand: game.brand, 
      device: game.device, 
      slides: game.slides || [],
      slideshowUrl: game.slideshowUrl || ''
    });
    setEditingId(game.id);
    setIsFormModalOpen(true);
  };

  const handleSlideshowUrlChange = (e) => {
    const val = e.target.value;
    const srcMatch = val.match(/src="([^"]+)"/);
    const finalUrl = srcMatch ? srcMatch[1] : val;
    setFormData({ ...formData, slideshowUrl: finalUrl });
  };

  const handleSlideUpload = (e) => {
    const files = Array.from(e.target.files || []);
    const readers = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    });
    Promise.all(readers).then(newSlides => {
      setFormData(prev => ({ ...prev, slides: [...(prev.slides || []), ...newSlides] }));
    });
  };

  const removeSlide = (index) => {
    setFormData(prev => ({ ...prev, slides: prev.slides.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const gameRef = doc(db, 'games', editingId);
        await updateDoc(gameRef, formData);
      } else {
        await addDoc(collection(db, 'games'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }
      setIsFormModalOpen(false);
    } catch (error) {
      console.error("Lỗi khi lưu game:", error);
      alert("Không thể lưu thông tin. Vui lòng thử lại!");
    }
  };

  const confirmDelete = async () => {
    if (gameToDelete) {
      try {
        await deleteDoc(doc(db, 'games', gameToDelete.id));
        setGameToDelete(null);
      } catch (error) {
        console.error("Lỗi khi xóa game:", error);
        alert("Không thể xóa game. Vui lòng thử lại!");
      }
    }
  };

  const handleAdminToggle = async () => {
    if (isAdmin) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Lỗi đăng xuất:", error);
      }
    } else {
      if (isLoggingIn) return;
      setIsLoggingIn(true);
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        if (error.code === 'auth/popup-blocked') {
          setAuthError("Trình duyệt đã chặn cửa sổ đăng nhập do ứng dụng đang chạy trong chế độ xem trước (Iframe). Vui lòng mở ứng dụng trong một thẻ mới để đăng nhập.");
        } else if (error.code === 'auth/cancelled-popup-request') {
          // Bỏ qua lỗi này vì người dùng có thể đã đóng popup hoặc click nhiều lần
        } else if (error.code !== 'auth/popup-closed-by-user') {
          setAuthError("Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.");
        }
      } finally {
        setIsLoggingIn(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans p-5 pb-16 relative">
      {/* Admin Toggle */}
      <div className="absolute top-5 right-5 z-10">
        <button 
          onClick={handleAdminToggle}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all shadow-sm ${isAdmin ? 'bg-rose-600 text-white shadow-rose-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
        >
          {isAdmin ? <Shield size={16} /> : <ShieldAlert size={16} />}
          {isAdmin ? 'Admin Mode: ON' : 'Admin Mode: OFF'}
        </button>
      </div>

      <div className="flex justify-center py-5 mb-5">
        <img 
          src="https://res.cloudinary.com/dxikjdqqn/image/upload/v1772852005/GAME_SHOWCASE_LOGO_rofj4l.png" 
          alt="VHWS Logo" 
          className="w-[200px] max-w-[250px] h-auto drop-shadow-md"
        />
      </div>

      <header className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-2 uppercase tracking-tighter text-rose-600 inline-block">
          Try Our Games
        </h1>
        <div className="w-[100px] h-[6px] bg-rose-600 mx-auto my-4 rounded-full"></div>
      </header>

      {/* Bộ lọc */}
      <div className="flex flex-wrap gap-6 justify-center mb-10 max-w-[1100px] mx-auto bg-slate-50 p-4 rounded-3xl border-2 border-slate-100">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-400 uppercase">Brand</span>
          <select 
            value={filterBrand} 
            onChange={e => setFilterBrand(e.target.value)}
            className="px-4 py-2 rounded-xl border-2 border-slate-200 focus:border-rose-600 outline-none bg-white font-bold"
          >
            {uniqueBrands.map(b => <option key={b} value={b}>{b === 'All' ? 'Tất cả' : b}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-400 uppercase">Device</span>
          <select 
            value={filterDevice} 
            onChange={e => setFilterDevice(e.target.value)}
            className="px-4 py-2 rounded-xl border-2 border-slate-200 focus:border-rose-600 outline-none bg-white font-bold"
          >
            {uniqueDevices.map(d => <option key={d} value={d}>{d === 'All' ? 'Tất cả' : d}</option>)}
          </select>
        </div>
      </div>

      {/* Grid Games */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 max-w-[1100px] mx-auto">
        {filteredGames.map(game => (
          <div 
            key={game.id}
            onClick={() => setSelectedGame(game)}
            className="group bg-white rounded-3xl p-10 cursor-pointer transition-all duration-400 shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex flex-col items-center border-2 border-transparent relative hover:-translate-y-4 hover:border-rose-600/10 hover:shadow-xl"
          >
            {isAdmin && (
              <div className="absolute top-4 right-4 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); openEditModal(game); }} className="p-2 bg-slate-100 rounded-full hover:bg-blue-100 text-slate-600 hover:text-blue-600"><Edit2 size={16} /></button>
                <button onClick={(e) => { e.stopPropagation(); setGameToDelete(game); }} className="p-2 bg-slate-100 rounded-full hover:bg-red-100 text-slate-600 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
            )}
            <div className="w-[100px] h-[100px] mb-6 bg-rose-50 rounded-2xl flex items-center justify-center text-5xl group-hover:bg-rose-600 group-hover:text-white transition-all">
              {game.icon && (game.icon.startsWith('data:image') || game.icon.startsWith('http')) ? (
                <img src={game.icon} alt={game.title} className="w-full h-full object-contain p-3" />
              ) : (
                game.icon
              )}
            </div>
            <h3 className="text-2xl font-black uppercase text-center">{game.title}</h3>
            <div className="text-sm text-rose-600 mt-4 font-bold opacity-70 uppercase tracking-widest">Chơi ngay</div>
          </div>
        ))}
        {isAdmin && (
          <div onClick={openAddModal} className="group rounded-3xl p-10 cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:bg-rose-50 hover:border-rose-600 transition-all min-h-[300px]">
            <Plus size={48} className="text-slate-300 group-hover:text-rose-600" />
            <h3 className="text-xl font-bold uppercase mt-4">Thêm Game</h3>
          </div>
        )}
      </div>

      {/* Modal chi tiết Game */}
      {selectedGame && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex justify-center items-center z-50 p-5 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && setSelectedGame(null)}>
          <div className="bg-white p-8 md:p-10 rounded-[40px] max-w-[900px] w-full relative text-center animate-modalIn border-4 border-rose-600 my-auto">
            <button onClick={() => setSelectedGame(null)} className="absolute top-6 right-6 text-slate-400 hover:text-rose-600"><X size={32} /></button>
            <h2 className="text-3xl md:text-5xl mb-6 text-rose-600 font-black uppercase">{selectedGame.title}</h2>

            <div className="flex flex-wrap justify-between items-end gap-4 mb-4">
              <div className="flex gap-2">
                {selectedGame.brand && <span className="px-3 py-1 bg-slate-100 text-slate-600 text-sm font-bold rounded-full uppercase tracking-wider">{selectedGame.brand}</span>}
                {selectedGame.device && <span className="px-3 py-1 bg-rose-50 text-rose-600 text-sm font-bold rounded-full uppercase tracking-wider">{selectedGame.device}</span>}
              </div>
            </div>

            <div className="bg-rose-50 p-6 rounded-3xl text-left border-l-8 border-rose-600 mb-8 text-lg">
              {selectedGame.rules}
            </div>

            {selectedGame.slideshowUrl && showIframe && (
              <div className="relative group mb-8">
                <div className="w-full aspect-video rounded-3xl overflow-hidden border-2 border-slate-100 shadow-inner bg-slate-900 animate-modalIn">
                  <iframe 
                    src={selectedGame.slideshowUrl}
                    className="w-full h-full"
                    frameBorder="0"
                    allowFullScreen={true}
                    title={`Slideshow for ${selectedGame.title}`}
                  />
                  <button 
                    onClick={() => setIsFullscreenSlideOpen(true)}
                    className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-slate-900 px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-xl transition-transform hover:scale-105"
                  >
                    <Maximize2 size={18} />
                    Toàn Màn Hình
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              {selectedGame.slides?.length > 0 && (
                <button onClick={() => { setSlideModalGame(selectedGame); setCurrentSlideIndex(0); }} className="flex-1 p-4 bg-slate-100 rounded-2xl font-black uppercase flex items-center justify-center gap-2 hover:bg-slate-200"><Images size={24} /> Gallery</button>
              )}
              {selectedGame.slideshowUrl && (
                <button 
                  onClick={() => setShowIframe(!showIframe)} 
                  className="flex-1 p-4 bg-rose-100 text-rose-700 rounded-2xl font-black sm:text-lg text-base hover:bg-rose-200 flex items-center justify-center gap-2 uppercase transition-colors"
                >
                  <Presentation size={24} /> {showIframe ? 'Đóng Slide' : 'Xem Slide'}
                </button>
              )}
              <a href={selectedGame.link} target="_blank" rel="noreferrer" className="flex-[2] p-4 bg-rose-600 text-white rounded-2xl font-black sm:text-xl text-lg shadow-lg hover:bg-rose-700 flex items-center justify-center gap-2 uppercase"><Globe size={24} /> Chơi Ngay</a>
            </div>
            
            <div className="pt-6 border-t border-slate-100 flex flex-col items-center">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 text-center">Quét QR để chơi trên thiết bị di động</p>
              <div className="p-4 bg-white inline-block border-2 border-dashed border-rose-200 rounded-3xl">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(selectedGame.link)}&color=e11d48`} alt="QR" width="120" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FULLSCREEN SLIDE */}
      {isFullscreenSlideOpen && selectedGame && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col animate-modalIn">
          <div className="absolute top-4 right-4 z-[110] flex gap-4">
             <span className="text-white/50 text-sm font-bold self-center bg-white/10 px-3 py-1 rounded-full uppercase tracking-widest">Bấm ESC để thoát</span>
             <button 
              onClick={() => setIsFullscreenSlideOpen(false)}
              className="bg-white/10 hover:bg-rose-600 text-white p-3 rounded-full transition-colors"
            >
              <X size={32} />
            </button>
          </div>
          <iframe 
            src={selectedGame.slideshowUrl}
            className="w-full h-full flex-1"
            frameBorder="0"
            allowFullScreen={true}
            title="Fullscreen Google Slides"
          />
        </div>
      )}

      {/* Modal Thêm/Sửa Game */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex justify-center items-center z-50 p-5 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && setIsFormModalOpen(false)}>
          <div className="bg-white p-8 md:p-10 rounded-[40px] max-w-[600px] w-full relative animate-modalIn border-4 border-rose-600 my-auto">
            <h2 className="text-3xl font-black text-rose-600 uppercase mb-8 text-center">{editingId ? 'Cập Nhật Game' : 'Thêm Game Mới'}</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                   <label className="block text-xs font-black uppercase text-slate-400 mb-1">Tên Game</label>
                   <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-rose-600 outline-none transition-all" />
                </div>
                <div>
                   <label className="block text-xs font-black uppercase text-slate-400 mb-1">Brand</label>
                   <input type="text" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-rose-600 outline-none" />
                </div>
                <div>
                   <label className="block text-xs font-black uppercase text-slate-400 mb-1">Thiết bị</label>
                   <input type="text" value={formData.device} onChange={e => setFormData({...formData, device: e.target.value})} className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-rose-600 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-400 mb-1">Mã Nhúng Google Slides</label>
                <div className="relative group">
                  <input 
                    type="text"
                    value={formData.slideshowUrl || ''}
                    onChange={handleSlideshowUrlChange}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-rose-600 outline-none transition-all pl-11"
                    placeholder="Dán link hoặc <iframe>..."
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-600">
                    <Presentation size={20} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-400 mb-1">Game Link (Chơi ngay)</label>
                <input type="url" required value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-rose-600 outline-none" />
              </div>

              <button type="submit" className="w-full p-4 bg-rose-600 text-white rounded-2xl font-black text-lg uppercase shadow-lg hover:bg-rose-700 transition-all">Lưu Thông Tin</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xác nhận xóa */}
      {gameToDelete && (
        <div className="fixed inset-0 bg-black/85 flex justify-center items-center z-50 p-5">
          <div className="bg-white p-8 rounded-[35px] max-w-[400px] w-full text-center border-4 border-red-500 animate-modalIn">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-black uppercase mb-4">Xác nhận xóa</h2>
            <p className="text-slate-500 mb-8">Bạn có chắc chắn muốn xóa game <strong className="text-slate-800">{gameToDelete.title}</strong>?</p>
            <div className="flex gap-4">
              <button onClick={() => setGameToDelete(null)} className="flex-1 p-4 bg-slate-100 rounded-2xl font-bold">Hủy</button>
              <button onClick={confirmDelete} className="flex-1 p-4 bg-red-500 text-white rounded-2xl font-bold">Xóa</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lỗi Đăng Nhập */}
      {authError && (
        <div className="fixed inset-0 bg-black/85 flex justify-center items-center z-[80] p-5">
          <div className="bg-white p-8 rounded-[35px] max-w-[400px] w-full text-center border-4 border-rose-600 animate-modalIn">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-black uppercase mb-4">Lỗi Đăng Nhập</h2>
            <p className="text-slate-600 mb-8 font-medium">{authError}</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => window.open(window.location.href, '_blank')} className="w-full p-4 bg-rose-600 text-white rounded-2xl font-bold uppercase hover:bg-rose-700 transition-colors">Mở trong thẻ mới</button>
              <button onClick={() => setAuthError('')} className="w-full p-4 bg-slate-100 text-slate-600 rounded-2xl font-bold uppercase hover:bg-slate-200 transition-colors">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Modal */}
      {slideModalGame && (
        <div className="fixed inset-0 bg-black/95 flex justify-center items-center z-[60] p-5" onClick={() => setSlideModalGame(null)}>
          <button className="absolute top-6 right-6 text-white/70 hover:text-white"><X size={40} /></button>
          <div className="relative w-full max-w-5xl aspect-video flex items-center justify-center">
            <img src={slideModalGame.slides[currentSlideIndex]} className="max-w-full max-h-full object-contain rounded-xl" alt="Gallery detail" />
            {slideModalGame.slides.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setCurrentSlideIndex(prev => (prev === 0 ? slideModalGame.slides.length - 1 : prev - 1)); }} className="absolute left-4 bg-black/50 text-white p-3 rounded-full"><ChevronLeft size={32} /></button>
                <button onClick={(e) => { e.stopPropagation(); setCurrentSlideIndex(prev => (prev === slideModalGame.slides.length - 1 ? 0 : prev + 1)); }} className="absolute right-4 bg-black/50 text-white p-3 rounded-full"><ChevronRight size={32} /></button>
              </>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-modalIn {
          animation: modalIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      ` }} />
    </div>
  );
}
