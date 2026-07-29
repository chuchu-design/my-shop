import { db, auth } from "./auth.js";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ADMIN_EMAIL = "chuchu20011225@gmail.com";

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = (error) => reject(error);
});

// 1. 後台商品發布
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

      const options = [];
      const optName1 = document.getElementById('opt-name-1').value.trim();
      const optPrice1 = document.getElementById('opt-price-1').value;
      if (optName1) options.push({ id: "opt_1", name: optName1, price: Number(optPrice1) });

      const optName2 = document.getElementById('opt-name-2').value.trim();
      const optPrice2 = document.getElementById('opt-price-2').value;
      if (optName2) options.push({ id: "opt_2", name: optName2, price: Number(optPrice2) });

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

// 2. 即時載入團員名單 (Firestore 'users' 集合)
const memberListContainer = document.getElementById('member-list-container');
if (memberListContainer) {
  onSnapshot(collection(db, "users"), (snapshot) => {
    if (snapshot.empty) {
      memberListContainer.innerHTML = "<p class='text-gray-500'>目前無任何註冊團員。</p>";
      return;
    }
    let html = `<div class='divide-y border rounded-lg overflow-hidden bg-white shadow-sm'>`;
    snapshot.forEach((doc) => {
      const user = doc.data();
      html += `
        <div class='p-3 flex justify-between items-center hover:bg-gray-50'>
          <div>
            <div class='font-bold text-gray-800'>${user.nickname || '未設定暱稱'}</div>
            <div class='text-xs text-gray-500'>${user.email || '無 Email'}</div>
          </div>
          <span class='text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-mono'>UID: ${doc.id.substring(0,6)}...</span>
        </div>
      `;
    });
    html += `</div>`;
    memberListContainer.innerHTML = html;
  }, (err) => {
    console.error("讀取團員失敗：", err);
    memberListContainer.innerHTML = `<p class='text-red-500 p-2'>載入團員失敗 (${err.message})</p>`;
  });
}

// 3. 即時載入訂單 (Firestore 'orders' 集合)
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