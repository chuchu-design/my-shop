// 1. 載入 Firebase 核心、Auth 與 Firestore 模組
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 2. Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyCzTKsFrttWiWECWsHRvDTJ9N_XPH0bWEM",
  authDomain: "my-shop-new-efdb0.firebaseapp.com",
  projectId: "my-shop-new-efdb0",
  storageBucket: "my-shop-new-efdb0.firebasestorage.app",
  messagingSenderId: "986465274332",
  appId: "1:986465274332:web:8a3a258549602f40c36719",
  measurementId: "G-0DYCN7TFL9"
};

// 3. 初始化服務
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const provider = new GoogleAuthProvider();

window.currentUser = null;
window.userProfile = null;

// Google 登入邏輯 (含首次暱稱設定)
window.handleGoogleLogin = async function() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // 檢查資料庫是否有此團員資料
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    let nickname = "";

    if (!userSnap.exists()) {
      // 首次登入：要求輸入暱稱（強制不能留空）
      while (!nickname || nickname.trim() === "") {
        nickname = prompt("歡迎第一次使用！請輸入您的專屬暱稱（設定後無法自行修改）：");
      }
      nickname = nickname.trim();

      // 儲存至資料庫
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        nickname: nickname,
        createdAt: new Date().toISOString()
      });
      alert(`暱稱設定完成！歡迎加入，${nickname}！`);
    } else {
      nickname = userSnap.data().nickname;
      alert(`歡迎回來，${nickname}！`);
    }

    window.userProfile = { uid: user.uid, email: user.email, nickname: nickname };
  } catch (error) {
    console.error("登入失敗:", error);
    alert("登入失敗，請稍後再試！");
  }
};

// 登出功能
window.handleLogout = async function() {
  await signOut(auth);
  window.currentUser = null;
  window.userProfile = null;
  alert("已成功登出");
  window.location.reload();
};

// 自動監聽登入狀態與載入暱稱
onAuthStateChanged(auth, async (user) => {
  window.currentUser = user;
  const desktopInfo = document.getElementById('user-info-desktop');
  const loginBtnDesktop = document.getElementById('login-btn-desktop');
  const loginBtnMobile = document.getElementById('login-btn-mobile');
  const orderNotice = document.getElementById('order-login-notice');

  if (user) {
    // 取得資料庫暱稱
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    let displayName = user.displayName;

    if (userSnap.exists()) {
      window.userProfile = userSnap.data();
      displayName = window.userProfile.nickname;
    }

    if (desktopInfo) desktopInfo.innerHTML = `👤 團員：${displayName}`;
    if (loginBtnDesktop) {
      loginBtnDesktop.innerText = "登出";
      loginBtnDesktop.onclick = window.handleLogout;
      loginBtnDesktop.className = "w-full bg-gray-500 text-white py-2 rounded-lg font-medium hover:bg-gray-600";
    }
    if (loginBtnMobile) {
      loginBtnMobile.innerText = "登出";
      loginBtnMobile.onclick = window.handleLogout;
    }
    if (orderNotice) orderNotice.classList.add('hidden');
  } else {
    window.userProfile = null;
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
    if (orderNotice) orderNotice.classList.remove('hidden');
  }
});