import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();
const ADMIN_EMAIL = "chuchu20011225@gmail.com";

// 監聽表單提交事件
const form = document.getElementById('add-product-form');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentUser = auth.currentUser;

    // 身分二次驗證
    if (!currentUser || currentUser.email !== ADMIN_EMAIL) {
      alert("權限不足！僅有團主可以執行上架操作。");
      return;
    }

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerText = "上架處理中...";

    // 讀取欄位資料
    const storeTitle = document.getElementById('store-title').value.trim();
    const productName = document.getElementById('product-name').value.trim();
    
    // 組裝選項陣列
    const options = [
      {
        id: "opt_1",
        name: document.getElementById('opt-name-1').value.trim(),
        price: Number(document.getElementById('opt-price-1').value)
      },
      {
        id: "opt_2",
        name: document.getElementById('opt-name-2').value.trim(),
        price: Number(document.getElementById('opt-price-2').value)
      }
    ];

    try {
      // 寫入 Firestore products 集合
      const docRef = await addDoc(collection(db, "products"), {
        storeTitle: storeTitle,     // 賣場：名偵探柯南30週年場販
        productName: productName,   // 品名：光柵立牌第二彈
        options: options,           // [盲抽一抽: 300, 端盒: 2950]
        status: "active",           // 開團狀態 (active / closed)
        createdAt: serverTimestamp(),
        createdBy: currentUser.email
      });

      console.log("商品新增成功，ID:", docRef.id);
      alert("🎉 商品上架成功！");
      form.reset();
    } catch (error) {
      console.error("寫入資料庫失敗：", error);
      alert("上架失敗，請確認 Firebase 權限或網路狀態！");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = "確認發布商品";
    }
  });
}