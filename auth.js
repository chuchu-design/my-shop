import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 帶入真實 Firebase 憑證
const firebaseConfig = {
  apiKey: "AIzaSyCzTKsFrttWiWECWsHRvDTJ9N_XPH0bWEM",
  authDomain: "my-shop-new-efdb0.firebaseapp.com",
  projectId: "my-shop-new-efdb0",
  storageBucket: "my-shop-new-efdb0.firebasestorage.app",
  messagingSenderId: "986465274332",
  appId: "1:986465274332:web:8a3a258549602f40c36719",
  measurementId: "G-0DYCN7TFL9"
};

// 初始化 Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();

// 登入狀態監聽與團員暱稱綁定
onAuthStateChanged(auth, async (user) => {
  const userInfoDiv = document.getElementById('user-info');
  if (!userInfoDiv) return;

  if (user) {
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      let nickname = user.displayName;

      if (!userDocSnap.exists() || !userDocSnap.data().nickname) {
        const inputName = prompt("歡迎使用！請輸入您的團員暱稱：", user.displayName || "");
        nickname = inputName && inputName.trim() ? inputName.trim() : (user.displayName || "匿名團員");
        
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          nickname: nickname,
          createdAt: new Date()
        }, { merge: true });
      } else {
        nickname = userDocSnap.data().nickname;
      }

      userInfoDiv.innerHTML = `
        <span class="text-sm font-semibold text-gray-700">👤 ${nickname}</span>
        <button id="logout-btn" class="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs px-3 py-1.5 rounded-lg">登出</button>
      `;

      document.getElementById('logout-btn')?.addEventListener('click', () => signOut(auth));
    } catch (e) {
      console.error("使用者資料讀取失敗：", e);
    }
  } else {
    userInfoDiv.innerHTML = `
      <button id="login-btn" class="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded-lg font-medium">
        Google 登入
      </button>
    `;

    document.getElementById('login-btn')?.addEventListener('click', async () => {
      try {
        await signInWithPopup(auth, provider);
      } catch (err) {
        alert("登入失敗：" + err.message);
      }
    });
  }
});