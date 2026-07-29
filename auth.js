// 1. 載入 Firebase 核心與 Auth 模組
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 2. 你的真實 Firebase 金鑰設定
const firebaseConfig = {
  apiKey: "AIzaSyCzTKsFrttWiWECWsHRvDTJ9N_XPH0bWEM",
  authDomain: "my-shop-new-efdb0.firebaseapp.com",
  projectId: "my-shop-new-efdb0",
  storageBucket: "my-shop-new-efdb0.firebasestorage.app",
  messagingSenderId: "986465274332",
  appId: "1:986465274332:web:8a3a258549602f40c36719",
  measurementId: "G-0DYCN7TFL9"
};

// 3. 初始化 Firebase 與 Google 登入服務
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 全域當前使用者變數
window.currentUser = null;

// Google 登入功能
window.handleGoogleLogin = async function() {
  try {
    const result = await signInWithPopup(auth, provider);
    window.currentUser = result.user;
    alert(`歡迎登入，${result.user.displayName}！`);
  } catch (error) {
    console.error("登入失敗:", error);
    alert("登入失敗，請稍後再試！");
  }
};

// 登出功能
window.handleLogout = async function() {
  await signOut(auth);
  window.currentUser = null;
  alert("已成功登出");
};

// 4. 自動監聽登入狀態（更新畫面的登入/登出按鈕與顯示姓名）
onAuthStateChanged(auth, (user) => {
  window.currentUser = user;
  const desktopInfo = document.getElementById('user-info-desktop');
  const loginBtnDesktop = document.getElementById('login-btn-desktop');
  const loginBtnMobile = document.getElementById('login-btn-mobile');
  const orderNotice = document.getElementById('order-login-notice');

  if (user) {
    // 已登入狀態
    if (desktopInfo) desktopInfo.innerHTML = `👤 ${user.displayName}`;
    if (loginBtnDesktop) {
      loginBtnDesktop.innerText = "登出";
      loginBtnDesktop.onclick = window.handleLogout;
      loginBtnDesktop.className = "w-full bg-gray-500 text-white py-2 rounded-lg font-medium hover:bg-gray-600";
    }
    if (loginBtnMobile) {
      loginBtnMobile.innerText = "登出";
      loginBtnMobile.onclick = window.handleLogout;
    }
    if (orderNotice) {
      orderNotice.classList.add('hidden'); // 隱藏未登入提示
    }
  } else {
    // 未登入狀態
    if (desktopInfo) desktopInfo.innerHTML = "未登入";
    if (loginBtnDesktop) {
      loginBtnDesktop.innerText = "Google 登入";
      loginBtnDesktop.onclick = window.handleGoogleLogin;
      loginBtnDesktop.className = "w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700";
    }
    if (loginBtnMobile) {
      loginBtnMobile.innerText = "登入";
      loginBtnMobile.onclick = window.handleGoogleLogin;
    }
    if (orderNotice) {
      orderNotice.classList.remove('hidden');
    }
  }
});