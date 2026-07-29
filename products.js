import { db, auth } from "./auth.js";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ADMIN_EMAIL = "chuchu20011225@gmail.com";

// Base64 轉換
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = (error) => reject(error);
});

// 1. 商品上架邏輯
const form = document.getElementById('add-product-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.email !== ADMIN_EMAIL) {
      alert("權限不足！僅有團主可以執行上架操作。");
      return;
    }

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerText = "商品上架處理中...";

    try {
      const storeTitle = document.getElementById('store-title').value.trim();
      const productName = document.getElementById('product-name').value.trim();
      let imageUrl = document.getElementById('product-img-url').value.trim();
      const fileInput = document.getElementById('product-img-file');
      
      if (fileInput && fileInput.files.length > 0) {
        imageUrl = await fileToBase64(fileInput.files[0]);
      }

      const options = [
        { id: "opt_1", name: document.getElementById('opt-name-1').value.trim(), price: Number(document.getElementById('opt-price-1').value) },
        { id: "opt_2", name: document.getElementById('opt-name-2').value.trim(), price: Number(document.getElementById('opt-price-2').value) }
      ];

      await addDoc(collection(db, "products"), {
        storeTitle,
        productName,
        imageUrl: imageUrl || "https://via.placeholder.com/300?text=No+Image",
        options,
        status: "active",
        createdAt: serverTimestamp(),
        createdBy: currentUser.email
      });

      alert("🎉 商品上架成功！前台頁面將會同步更新。");
      form.reset();
    } catch (error) {
      console.error("上架失敗：", error);
      alert("上架失敗：" + error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = "確認發布商品";
    }
  });
}

// 2. 即時載入團員資料
const memberListContainer = document.getElementById('member-list-container');
if (memberListContainer) {
  onSnapshot(collection(db, "users"), (snapshot) => {
    if (snapshot.empty) {
      memberListContainer.innerHTML = "<p class='text-gray-500'>目前無任何註冊團員。</p>";
      return;
    }
    let html = `<div class='divide-y border rounded-lg overflow-hidden bg-white'>`;
    snapshot.forEach((doc) => {
      const user = doc.data();
      html += `
        <div class='p-3 flex justify-between items-center hover:bg-gray-50'>
          <div>
            <div class='font-bold text-gray-800'>${user.nickname || '未設定暱稱'}</div>
            <div class='text-xs text-gray-500'>${user.email || ''}</div>
          </div>
          <span class='text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded'>UID: ${doc.id.substring(0,6)}...</span>
        </div>
      `;
    });
    html += `</div>`;
    memberListContainer.innerHTML = html;
  }, (err) => {
    memberListContainer.innerHTML = `<p class='text-red-500'>載入團員失敗：${err.message}</p>`;
  });
}

// 3. 即時載入訂單資料
const orderListContainer = document.getElementById('order-list-container');
if (orderListContainer) {
  const qOrders = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  onSnapshot(qOrders, (snapshot) => {
    if (snapshot.empty) {
      orderListContainer.innerHTML = "<p class='text-gray-500'>目前尚無下單紀錄。</p>";
      return;
    }
    let html = `<div class='space-y-3'>`;
    snapshot.forEach((doc) => {
      const order = doc.data();
      html += `
        <div class='p-4 border rounded-lg bg-white shadow-sm'>
          <div class='flex justify-between items-center mb-2 border-b pb-2'>
            <span class='font-bold text-blue-600'>${order.userName || '買家'} (${order.userEmail})</span>
            <span class='text-xs text-gray-400'>${order.status || '處理中'}</span>
          </div>
          <div class='text-sm text-gray-700'>
            <strong>品名：</strong>${order.productName || ''} - ${order.optionName || ''}
          </div>
          <div class='text-sm text-gray-700'>
            <strong>金額：</strong>NT$ ${order.price || 0}
          </div>
        </div>
      `;
    });
    html += `</div>`;
    orderListContainer.innerHTML = html;
  }, (err) => {
    orderListContainer.innerHTML = `<p class='text-gray-500'>尚無下單紀錄</p>`;
  });
}