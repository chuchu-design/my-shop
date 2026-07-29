import { db, auth } from "./auth.js";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, arrayUnion, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ADMIN_EMAIL = "chuchu20011225@gmail.com";

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = (error) => reject(error);
});

let cachedUsersMap = {};
let cachedProductsList = [];
let cachedOrdersList = [];

// 1. 上架商品
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

      alert("🎉 商品上架成功！");
      form.reset();
    } catch (error) {
      alert("上架失敗：" + error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = "確認發布商品";
    }
  });
}

// 2. 代下單
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
      alert("請選擇團員與商品！");
      return;
    }

    const targetUser = cachedUsersMap[userVal] || { uid: userVal, nickname: "指定團員", email: "團主手動輸入" };
    const [pId, optIndexStr] = prodVal.split('___');
    const targetProduct = cachedProductsList.find(p => p.id === pId);
    const targetOption = targetProduct ? targetProduct.options[Number(optIndexStr)] : null;

    if (!targetProduct || !targetOption) {
      alert("找不到對應商品選項，請重新選取");
      return;
    }

    try {
      await addDoc(collection(db, "orders"), {
        userId: targetUser.uid,
        userName: targetUser.nickname || "團員",
        userEmail: targetUser.email || "",
        storeTitle: targetProduct.storeTitle,
        productName: targetProduct.productName,
        optionName: targetOption.name,
        price: targetOption.price,
        qty: qtyVal,
        status: "團主代下單",
        historyLogs: [{
          action: `團主手動代下單：${targetProduct.productName} (${targetOption.name}) x${qtyVal}`,
          operator: currentUser.email,
          timestamp: new Date().toLocaleString()
        }],
        createdAt: serverTimestamp()
      });

      alert("✅ 成功幫【" + (targetUser.nickname || '團員') + "】完成代下單！");
      proxyForm.reset();
    } catch (err) {
      alert("代下單失敗：" + err.message);
    }
  });
}

// 3. 團員名單監聽
const memberListContainer = document.getElementById('member-list-container');
onSnapshot(collection(db, "users"), (snapshot) => {
  cachedUsersMap = {};
  const proxyUserSelect = document.getElementById('proxy-user-select');
  let selectHtml = `<option value="">-- 請選擇團員 --</option>`;

  if (snapshot.empty) {
    if(memberListContainer) memberListContainer.innerHTML = "<p class='text-gray-500'>目前無任何註冊團員。</p>";
    if(proxyUserSelect) proxyUserSelect.innerHTML = selectHtml;
    return;
  }

  let html = `<div class='divide-y border rounded-lg overflow-hidden bg-white shadow-sm'>`;
  snapshot.forEach((docSnap) => {
    const user = docSnap.data();
    const uId = docSnap.id;
    
    const nickname = user.nickname || user.displayName || "未取暱稱團員";
    const email = user.email || "無 Gmail";

    cachedUsersMap[uId] = { uid: uId, nickname, email };
    cachedUsersMap[user.uid] = { uid: uId, nickname, email };

    selectHtml += `<option value="${uId}">👤 ${nickname} (${email})</option>`;

    html += `
      <div class='p-3 flex justify-between items-center hover:bg-gray-50'>
        <div>
          <div class='font-bold text-gray-900 text-base flex items-center gap-2'>
            🏷️ 團員暱稱：<span class="text-blue-600 font-extrabold">${nickname}</span>
            <button onclick="editNickname('${uId}', '${nickname}')" class='text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded border'>✏️ 改暱稱</button>
          </div>
          <div class='text-xs text-gray-500 font-mono mt-1'>📧 Gmail: ${email}</div>
        </div>
        <span class='text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-mono'>ID: ${uId.substring(0,5)}</span>
      </div>
    `;
  });
  html += `</div>`;
  if(memberListContainer) memberListContainer.innerHTML = html;
  if(proxyUserSelect) proxyUserSelect.innerHTML = selectHtml;
});

// 4. 商品開團監聽
onSnapshot(collection(db, "products"), (snapshot) => {
  cachedProductsList = [];
  const proxyProductSelect = document.getElementById('proxy-product-select');
  let selectHtml = `<option value="">-- 請選擇商品與規格 --</option>`;

  snapshot.forEach(docSnap => {
    const prod = { id: docSnap.id, ...docSnap.data() };
    cachedProductsList.push(prod);

    (prod.options || []).forEach((opt, idx) => {
      selectHtml += `<option value="${prod.id}___${idx}">【${prod.storeTitle}】${prod.productName} - ${opt.name} ($${opt.price})</option>`;
    });
  });

  if(proxyProductSelect) proxyProductSelect.innerHTML = selectHtml;
});

window.editNickname = async (userId, oldNickname) => {
  const newNickname = prompt("修改團員暱稱：", oldNickname);
  if (newNickname && newNickname.trim() !== "") {
    try {
      await updateDoc(doc(db, "users", userId), { nickname: newNickname.trim() });
      alert("✅ 暱稱修改成功！");
    } catch (e) {
      alert("修改失敗：" + e.message);
    }
  }
};

// 5. 完整編輯訂單 (支援商品、規格、單價、數量、狀態修改) (需求 1)
window.editOrderFull = async (orderId) => {
  const targetOrder = cachedOrdersList.find(o => o.id === orderId);
  if (!targetOrder) return;

  const newProductName = prompt("修改【商品名稱】：", targetOrder.productName || "");
  if (newProductName === null) return;

  const newOptionName = prompt("修改【款式規格】：", targetOrder.optionName || "");
  if (newOptionName === null) return;

  const newPrice = prompt("修改【單價 NT$】：", targetOrder.price || 0);
  if (newPrice === null) return;

  const newQty = prompt("修改【數量】：", targetOrder.qty || 1);
  if (newQty === null) return;

  const newStatus = prompt("修改【訂單狀態】(如：已下單 / 已付款 / 已發貨)：", targetOrder.status || "已下單");
  if (newStatus === null) return;

  const note = prompt("備註 (記錄於 Logs)：", "團主後台全面修改欄位");

  const currentUser = auth.currentUser;

  try {
    await updateDoc(doc(db, "orders", orderId), {
      productName: newProductName.trim(),
      optionName: newOptionName.trim(),
      price: Number(newPrice),
      qty: Number(newQty),
      status: newStatus.trim(),
      historyLogs: arrayUnion({
        action: `團主修改訂單細項: ${newProductName} (${newOptionName}) x${newQty}, 單價: $${newPrice}, 狀態: ${newStatus} (備註: ${note || '無'})`,
        operator: currentUser ? currentUser.email : "團主",
        timestamp: new Date().toLocaleString()
      })
    });
    alert("✅ 訂單資料已成功修改！");
  } catch (err) {
    alert("修改失敗：" + err.message);
  }
};

// 6. 合併訂單彈窗邏輯 (需求 1)
window.openMergeModal = () => {
  const sourceSel = document.getElementById('merge-source-select');
  const targetSel = document.getElementById('merge-target-select');

  let html = `<option value="">-- 請選擇訂單 --</option>`;
  cachedOrdersList.forEach(o => {
    const uMatch = cachedUsersMap[o.userId];
    const name = uMatch ? uMatch.nickname : (o.userName || '團員');
    html += `<option value="${o.id}">[${name}] ${o.productName}-${o.optionName} (x${o.qty || 1})</option>`;
  });

  sourceSel.innerHTML = html;
  targetSel.innerHTML = html;
  document.getElementById('merge-modal').classList.remove('hidden');
};

window.closeMergeModal = () => document.getElementById('merge-modal').classList.add('hidden');

window.executeMergeOrders = async () => {
  const sourceId = document.getElementById('merge-source-select').value;
  const targetId = document.getElementById('merge-target-select').value;

  if (!sourceId || !targetId) return alert("請完整選取來源與目標訂單！");
  if (sourceId === targetId) return alert("來源訂單與目標訂單不能相同！");

  const sourceOrd = cachedOrdersList.find(o => o.id === sourceId);
  const targetOrd = cachedOrdersList.find(o => o.id === targetId);

  if (!confirm(`確定要把【${sourceOrd.productName}-${sourceOrd.optionName} x${sourceOrd.qty}】\n合併進【${targetOrd.productName}-${targetOrd.optionName} x${targetOrd.qty}】嗎？\n(來源訂單會被移除)`)) return;

  const currentUser = auth.currentUser;
  const newQty = (targetOrd.qty || 1) + (sourceOrd.qty || 1);

  try {
    // 累加目標訂單數量並下記錄
    await updateDoc(doc(db, "orders", targetId), {
      qty: newQty,
      historyLogs: arrayUnion({
        action: `合併訂單：併入訂單 (${sourceOrd.productName} x${sourceOrd.qty})，數量累加至 ${newQty}`,
        operator: currentUser ? currentUser.email : "團主",
        timestamp: new Date().toLocaleString()
      })
    });

    // 刪除被合併的來源訂單
    await deleteDoc(doc(db, "orders", sourceId));

    alert("🎉 訂單合併成功！");
    closeMergeModal();
  } catch(e) {
    alert("合併失敗：" + e.message);
  }
};

// 7. 訂單總覽監聽
const orderListContainer = document.getElementById('order-list-container');
if (orderListContainer) {
  onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snapshot) => {
    cachedOrdersList = [];
    if (snapshot.empty) {
      orderListContainer.innerHTML = "<p class='text-gray-500'>目前尚無下單紀錄。</p>";
      return;
    }
    let html = `<div class='space-y-4'>`;
    snapshot.forEach((docSnap) => {
      const order = { id: docSnap.id, ...docSnap.data() };
      cachedOrdersList.push(order);

      const userMatch = cachedUsersMap[order.userId];
      const showNickname = userMatch ? userMatch.nickname : (order.userName || "團員");
      const showEmail = userMatch ? userMatch.email : (order.userEmail || "無 Email");

      let logsHtml = '';
      if (order.historyLogs && order.historyLogs.length > 0) {
        logsHtml = `<div class="mt-3 pt-2 border-t border-dashed border-gray-200 space-y-1">
          <div class="text-xs font-bold text-gray-500">📜 團主專屬變更履歷 (Logs)：</div>`;
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
          <div class='flex justify-between items-start mb-2 border-b pb-2'>
            <div>
              <div class='font-black text-blue-700 text-lg'>👤 團員暱稱：${showNickname}</div>
              <div class='text-xs text-gray-500 font-mono'>📧 Email: ${showEmail}</div>
            </div>
            <div class="flex items-center gap-2">
              <span class='text-xs bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded'>${order.status || '已下單'}</span>
              <button onclick="editOrderFull('${order.id}')" 
                      class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded border font-bold">
                ✏️ 編輯全細項/紀錄
              </button>
            </div>
          </div>
          <div class='text-xs font-semibold text-blue-800 bg-blue-50 inline-block px-2 py-0.5 rounded mb-1'>
            📢 ${order.storeTitle || '未分組團購'}
          </div>
          <div class='text-sm text-gray-800'>
            <strong>商品：</strong>${order.productName || ''} - <span class="text-blue-600 font-bold">${order.optionName || ''}</span> x${order.qty || 1}
          </div>
          <div class='text-sm text-gray-800 mt-0.5'>
            <strong>總金額：</strong>NT$ ${(order.price || 0) * (order.qty || 1)}
          </div>

          ${logsHtml}
        </div>
      `;
    });
    html += `</div>`;
    orderListContainer.innerHTML = html;
  });
}