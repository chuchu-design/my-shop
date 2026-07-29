import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ⚠️ 請替換為你的 Firebase 專案配置資訊 ⚠️
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 防重複初始化
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();

// 全局監聽登入狀態
onAuthStateChanged(auth, async (user) => {
  const userInfoDiv = document.getElementById('user-info');
  if (!userInfoDiv) return;

  if (user) {
    // 檢查是否有暱稱
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    let nickname = user.displayName;

    if (!userDocSnap.exists() || !userDocSnap.data().nickname) {
      const inputName = prompt("歡迎第一次使用！請輸入您的暱稱（方便團主對帳）：", user.displayName || "");
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