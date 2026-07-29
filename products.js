import { db, auth } from "./auth.js";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ADMIN_EMAIL = "chuchu20011225@gmail.com";

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = (error) => reject(error);
});

let cachedUsers = {};
let cachedProducts = [];

// 1. 商品發布
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

      alert("🎉 商品上架成功！已在對應團購中發布。");
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

// 2. 代下單邏輯
const proxyForm = document.getElementById('proxy-order-form');
if (proxyForm) {
  proxyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.email !== ADMIN_EMAIL) {
      alert("僅有團主可代下單！");
      return;
    }

    const userVal = document.getElementById('proxy-user-select').value;
    const prodVal = document.getElementById('proxy-product-select').value;
    const qtyVal = Number(document.getElementById('proxy-qty').value);

    if (!userVal || !prodVal) {
      alert("請完整選擇團員與商品選項！");
      return;
    }

    const targetUser = cachedUsers[userVal];
    const [pId, optIndexStr] = prodVal.split('___');
    const targetProduct = cachedProducts.find(p => p.id === pId);
    const targetOption = targetProduct.options[Number(optIndexStr)];

    try {
      await addDoc(collection(db, "orders"), {
        userId: targetUser.uid,
        userName: targetUser.nickname || targetUser.displayName || "團員",
        userEmail: targetUser.email,
        storeTitle: targetProduct.storeTitle,
        productName: targetProduct.productName,
        optionName: targetOption.name,
        price: targetOption.price,
        qty: qtyVal,
        status: "團主代下單",
        historyLogs: [{
          action: `團主手動代下單 (${targetProduct.productName} - ${targetOption.name} x${qtyVal})`,
          operator: currentUser.email,
          timestamp: new Date().toLocaleString()
        }],
        createdAt: serverTimestamp()
      });

      alert("✅ 成功幫團員下單！");
      proxyForm.reset();
    } catch (err) {
      alert("代下單失敗：" + err.message);
    }
  });
}

// 3. 團員名單 & 暱稱/Gmail 整合監聽
const memberListContainer = document.getElementById('member-list-container');
if (memberListContainer) {
  onSnapshot(collection(db, "users"), (snapshot) => {
    cachedUsers = {};
    const proxyUserSelect = document.getElementById('proxy-user-select');
    let selectHtml = `<option value="">-- 請選擇團員 --</option>`;

    if (snapshot.empty) {
      memberListContainer.innerHTML = "<p class='text-gray-500'>目前無任何註冊團員。</p>";
      if(proxyUserSelect) proxyUserSelect.innerHTML = selectHtml;
      return;
    }

    let html = `<div class='divide-y border rounded-lg overflow-hidden bg-white shadow-sm'>`;
    snapshot.forEach((docSnap) => {
      const user = docSnap.data();
      const userId = docSnap.id;
      cachedUsers[userId] = { uid: userId, ...user };

      const displayName = user.nickname || "未設定暱稱";
      const gmail = user.email || "無 Email";

      selectHtml += `<option value="${userId}">👤 ${displayName} (${gmail})</option>`;

      html += `
        <div class='p-3 flex justify-between items-center hover:bg-gray-50'>
          <div>
            <div class='font-bold text-gray-800 flex items-center gap-2'>
              👤 暱稱：${displayName}
              <button onclick="editNickname('${userId}', '${displayName}')" class='text-xs text-blue-600 hover:underline'>✏️ 改暱稱</button>
            </div>
            <div class='text-xs text-gray-500 font-mono'>📧 Gmail: ${gmail}</div>
          </div>
          <span class='text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-mono'>UID: ${userId.substring(0,6)}...</span>
        </div>
      `;
    });
    html += `</div>`;
    memberListContainer.innerHTML = html;
    if(proxyUserSelect) proxyUserSelect.innerHTML = selectHtml;
  });
}

// 4. 即時同步前台現有商品給代下單選單
onSnapshot(collection(db, "products"), (snapshot) => {
  cachedProducts = [];
  const proxyProductSelect = document.getElementById('proxy-product-select');
  let selectHtml = `<option value="">-- 請選擇商品與規格 --</option>`;

  snapshot.forEach(docSnap => {
    const prod = { id: docSnap.id, ...docSnap.data() };
    cachedProducts.push(prod);

    (prod.options || []).forEach((opt, idx) => {
      selectHtml += `<option value="${prod.id}___${idx}">【${prod.storeTitle}】${prod.productName} - ${opt.name} (NT$ ${opt.price})</option>`;
    });
  });

  if(proxyProductSelect) proxyProductSelect.innerHTML = selectHtml;
});

// 團主修改暱稱
window.editNickname = async (userId, oldNickname) => {
  const newNickname = prompt("請輸入該團員的新暱稱：", oldNickname);
  if (newNickname !== null && newNickname.trim() !== "") {
    try {
      await updateDoc(doc(db, "users", userId), { nickname: newNickname.trim() });
      alert("✅ 暱稱修改成功！");
    } catch (e) {
      alert("修改失敗：" + e.message);
    }
  }
};

// 5. 編輯訂單
window.editOrder = async (orderId, currentPrice, currentQty, currentStatus) => {
  const newPrice = prompt("修改單價 (NT$)：", currentPrice);
  if (newPrice === null) return;
  const newQty = prompt("修改數量：", currentQty);
  if (newQty === null) return;
  const newNote = prompt("新增異動/轉單備註（例如: 轉單給團員 B / 團主後台調整）：", "團主手動修改訂單");

  const currentUser = auth.currentUser;

  try {
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, {
      price: Number(newPrice),
      qty: Number(newQty),
      historyLogs: arrayUnion({
        action: `編輯訂單: 單價改為 NT$${newPrice}, 數量改為 ${newQty} (備註: ${newNote || '無'})`,
        operator: currentUser ? currentUser.email : "團主",
        timestamp: new Date().toLocaleString()
      })
    });
    alert("✅ 訂單與歷史紀錄更新成功！");
  } catch (err) {
    alert("修改失敗：" + err.message);
  }
};

// 6. 訂單總覽 (顯示最新暱稱 + Gmail)
const orderListContainer = document.getElementById('order-list-container');
if (orderListContainer) {
  const qOrders = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  onSnapshot(qOrders, (snapshot) => {
    if (snapshot.empty) {
      orderListContainer.innerHTML = "<p class='text-gray-500'>目前尚無下單紀錄。</p>";
      return;
    }
    let html = `<div class='space-y-4'>`;
    snapshot.forEach((docSnap) => {
      const order = docSnap.data();
      const orderId = docSnap.id;

      // 檢查是否能取得當前最新的團員暱稱
      const latestUser = cachedUsers[order.userId];
      const showNickname = (latestUser && latestUser.nickname) ? latestUser.nickname : (order.userName || '團員');
      const showEmail = order.userEmail || (latestUser ? latestUser.email : '無 Email');

      // 歷史紀錄 Logs
      let logsHtml = '';
      if (order.historyLogs && order.historyLogs.length > 0) {
        logsHtml = `<div class="mt-3 pt-2 border-t border-dashed border-gray-200 space-y-1">
          <div class="text-xs font-bold text-gray-500">📜 團主專屬操作履歷 (Logs)：</div>`;
        order.historyLogs.forEach(log => {
          logsHtml += `
            <div class="text-xs text-gray-600 bg-gray-50 p-1.5 rounded flex justify-between items-center">
              <span>• ${log.action} <span class="text-gray-400">(${log.operator})</span></span>
              <span class="text-[10px] text-gray-400 font-mono">${log.timestamp}</span>
            </div>
          `;
        });
        logsHtml += `</div>`;
      }

      html += `
        <div class='p-4 border rounded-xl bg-white shadow-sm'>
          <div class='flex justify-between items-center mb-2 border-b pb-2'>
            <div>
              <span class='font-bold text-blue-600 text-base'>👤 暱稱：${showNickname}</span>
              <span class='text-xs text-gray-500 block font-mono'>📧 Email: ${showEmail}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class='text-xs bg-green-100 text-green-800 font-semibold px-2 py-0.5 rounded'>${order.status || '已下單'}</span>
              <button onclick="editOrder('${orderId}', ${order.price}, ${order.qty || 1}, '${order.status}')" 
                      class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded border">
                ✏️ 編輯/轉單紀錄
              </button>
            </div>
          </div>
          <div class='text-xs font-semibold text-blue-800 bg-blue-50 inline-block px-2 py-0.5 rounded mb-1'>
            📢 ${order.storeTitle || '未分組團購'}
          </div>
          <div class='text-sm text-gray-700'>
            <strong>商品：</strong>${order.productName || ''} - <span class="text-blue-600 font-medium">${order.optionName || ''}</span> x${order.qty || 1}
          </div>
          <div class='text-sm text-gray-700 mt-0.5'>
            <strong>總金額：</strong>NT$ ${(order.price || 0) * (order.qty || 1)}
          </div>

          ${logsHtml}
        </div>
      `;
    });
    html += `</div>`;
    orderListContainer.innerHTML = html;
  }, (err) => {
    orderListContainer.innerHTML = `<p class='text-gray-500'>尚無下單紀錄</p>`;
  });
}