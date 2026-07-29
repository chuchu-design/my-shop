import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 請至 Firebase Console -> 專案設定 -> 一般 -> 你的應用程式 中複製貼上專案設定：
// (如果你記得之前的 apiKey，請將下方括號處換成你原本的真實字串)
const firebaseConfig = {
  apiKey: "AIzaSy...", // 👈 請將此處替換為你真實的 Firebase API Key
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 初始化 App 與服務
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();

// 1. 登入 / 登出與暱稱綁定邏輯
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
      console.error("讀取或寫入使用者資料失敗：", e);
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