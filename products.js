import { db, auth } from "./auth.js";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const ADMIN_EMAIL = "chuchu20011225@gmail.com";

// 1. 後台權限防護：非團主一律開啟阻擋彈窗 (需求 1)
onAuthStateChanged(auth, (user) => {
  const overlay = document.getElementById('unauthorized-overlay');
  if (!user || user.email !== ADMIN_EMAIL) {
    if (overlay) overlay.classList.remove('hidden');
  } else {
    if (overlay) overlay.classList.add('hidden');
  }
});

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = (error) => reject(error);
});

let cachedUsersMap = {};
let cachedProductsList = [];
let cachedOrdersList = [];
let optionCount = 0;

// 款式選項動態新增/編輯
export const addOptionRow = (defaultName = "", defaultPrice = "") => {
  optionCount++;
  const container = document.getElementById('options-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = "flex gap-2 items-center bg-gray-50 p-2.5 rounded-lg border border-gray-200 option-row";
  row.id = `opt-row-${optionCount}`;

  row.innerHTML = `
    <input type="text" class="opt-name w-2/3 border rounded p-2 text-xs" placeholder="款式名稱 (例: 盲抽一抽)" value="${defaultName}" required>
    <div class="w-1/3 flex items-center bg-white border rounded px-2">
      <span class="text-gray-400 text-xs mr-1">NT$</span>
      <input type="number" class="opt-price w-full border-none p-1.5 text-xs focus:outline-none" placeholder="價格" value="${defaultPrice}" required>
    </div>
    <button type="button" class="delete-opt-btn text-red-500 hover:text-red-700 text-sm px-1.5 font-bold" title="刪除">&times;</button>
  `;

  row.querySelector('.delete-opt-btn').addEventListener('click', () => {
    if (container.querySelectorAll('.option-row').length <= 1) return alert("商品至少需要保留一個款式選項！");
    row.remove();
  });

  container.appendChild(row);
};

window.addOptionRow = addOptionRow;

window.addEditOptionRow = (defaultName = "", defaultPrice = "", isOutOfStock = false) => {
  const container = document.getElementById('edit-options-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = "flex gap-2 items-center bg-gray-50 p-2 rounded border edit-option-row";

  row.innerHTML = `
    <input type="text" class="edit-opt-name w-1/2 border rounded p-1.5 text-xs" placeholder="款式名稱" value="${defaultName}" required>
    <div class="w-1/4 flex items-center bg-white border rounded px-1.5">
      <span class="text-gray-400 text-xs mr-0.5">$</span>
      <input type="number" class="edit-opt-price w-full border-none p-1 text-xs focus:outline-none" placeholder="價格" value="${defaultPrice}" required>
    </div>
    <label class="flex items-center gap-1 cursor-pointer select-none text-[11px] font-bold text-red-600 bg-red-50 p-1 rounded border border-red-200">
      <input type="checkbox" class="edit-opt-stock focus:ring-0" ${isOutOfStock ? 'checked' : ''}>
      缺貨
    </label>
    <button type="button" class="delete-edit-opt-btn text-red-500 hover:text-red-700 text-sm px-1 font-bold">&times;</button>
  `;

  row.querySelector('.delete-edit-opt-btn').addEventListener('click', () => {
    if (container.querySelectorAll('.edit-option-row').length <= 1) return alert("商品至少需要保留一個款式選項！");
    row.remove();
  });

  container.appendChild(row);
};

document.addEventListener('DOMContentLoaded', () => {
  const addBtn = document.getElementById('add-option-btn');
  if (addBtn) addBtn.addEventListener('click', () => addOptionRow());

  const container = document.getElementById('options-container');
  if (container && container.children.length === 0) {
    addOptionRow("盲抽一抽", "300");
    addOptionRow("端盒", "2950");
  }
});

// 2. 上架商品
const form = document.getElementById('add-product-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.email !== ADMIN_EMAIL) return alert("權限不足！");

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;

    try {
      const storeTitle = document.getElementById('store-title').value.trim();
      const productName = document.getElementById('product-name').value.trim();
      let imageUrl = document.getElementById('product-img-url').value.trim();
      const fileInput = document.getElementById('product-img-file');
      
      if (fileInput && fileInput.files.length > 0) imageUrl = await fileToBase64(fileInput.files[0]);

      const options = [];
      document.querySelectorAll('.option-row').forEach((row, idx) => {
        const nameInput = row.querySelector('.opt-name');
        const priceInput = row.querySelector('.opt-price');
        if (nameInput && priceInput && nameInput.value.trim() !== "") {
          options.push({
            id: `opt_${idx + 1}`,
            name: nameInput.value.trim(),
            price: Number(priceInput.value),
            isOutOfStock: false
          });
        }
      });

      if (options.length === 0) return alert("請至少填寫一個有效的商品規格！");

      await addDoc(collection(db, "products"), {
        storeTitle,
        productName,
        imageUrl: imageUrl || "https://via.placeholder.com/300?text=No+Image",
        options,
        status: "active",
        createdAt: serverTimestamp(),
        createdBy: currentUser.email
      });

      alert(`🎉 商品【${productName}】已成功上架！`);
      form.reset();
      document.getElementById('options-container').innerHTML = "";
      addOptionRow("盲抽一抽", "300");
      addOptionRow("端盒", "2950");
    } catch (error) {
      alert("上架失敗：" + error.message);
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// 3. 管理已上架商品
const adminProductsContainer = document.getElementById('admin-products-list');
onSnapshot(query(collection(db, "products"), orderBy("createdAt", "desc")), (snapshot) => {
  cachedProductsList = [];
  const proxyProductSelect = document.getElementById('proxy-product-select');
  let selectHtml = `<option value="">-- 請選擇商品與規格 --</option>`;

  if (snapshot.empty) {
    if (adminProductsContainer) adminProductsContainer.innerHTML = "<p class='text-gray-500'>目前資料庫中無任何商品。</p>";
    if (proxyProductSelect) proxyProductSelect.innerHTML = selectHtml;
    return;
  }

  let adminHtml = "";
  snapshot.forEach(docSnap => {
    const prod = { id: docSnap.id, ...docSnap.data() };
    cachedProductsList.push(prod);

    if (prod.status !== "archived") {
      (prod.options || []).forEach((opt, idx) => {
        const stockLabel = opt.isOutOfStock ? " [缺貨中]" : "";
        selectHtml += `<option value="${prod.id}___${idx}" ${opt.isOutOfStock ? 'disabled' : ''}>【${prod.storeTitle}】${prod.productName} - ${opt.name} ($${opt.price})${stockLabel}</option>`;
      });
    }

    const optionsBadges = (prod.options || []).map((o, idx) => {
      const isOut = !!o.isOutOfStock;
      return `
        <div class="flex items-center gap-1.5 bg-gray-50 border px-2 py-1 rounded text-xs">
          <span class="${isOut ? 'line-through text-gray-400' : 'font-bold text-gray-700'}">${o.name} ($${o.price})</span>
          <button onclick="toggleSingleOptionStock('${prod.id}', ${idx})" class="text-[10px] font-bold px-1.5 py-0.5 rounded border transition ${isOut ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}">
            ${isOut ? '補貨' : '設缺貨'}
          </button>
        </div>
      `;
    }).join('');

    let statusBadge = `<span class="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded font-bold">🟢 上架中</span>`;
    if (prod.status === "archived") statusBadge = `<span class="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded font-bold">⚪ 已下架</span>`;

    adminHtml += `
      <div class="p-4 border rounded-xl bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div class="flex items-center gap-3">
          <img src="${prod.imageUrl}" class="w-16 h-16 object-cover rounded-lg border">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">${prod.storeTitle}</span>
              ${statusBadge}
            </div>
            <h4 class="font-bold text-gray-900">${prod.productName}</h4>
            <div class="flex flex-wrap gap-1.5 mt-2">${optionsBadges}</div>
          </div>
        </div>

        <div class="flex items-center gap-2 w-full md:w-auto justify-end">
          <button onclick="openEditProductModal('${prod.id}')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded border font-bold">
            ✏️ 編輯商品全貌
          </button>
          <button onclick="changeProductStatus('${prod.id}', '${prod.status === 'archived' ? 'active' : 'archived'}')" class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded border font-bold">
            ${prod.status === 'archived' ? '⬆️ 重新上架' : '📦 整件下架'}
          </button>
        </div>
      </div>
    `;
  });

  if (adminProductsContainer) adminProductsContainer.innerHTML = adminHtml;
  if (proxyProductSelect) proxyProductSelect.innerHTML = selectHtml;
});

window.toggleSingleOptionStock = async (productId, optionIdx) => {
  const prod = cachedProductsList.find(p => p.id === productId);
  if (!prod || !prod.options || !prod.options[optionIdx]) return;

  const newOptions = [...prod.options];
  newOptions[optionIdx].isOutOfStock = !newOptions[optionIdx].isOutOfStock;
  try {
    await updateDoc(doc(db, "products", productId), { options: newOptions });
  } catch (e) {
    alert("更新狀態失敗：" + e.message);
  }
};

window.changeProductStatus = async (productId, newStatus) => {
  try {
    await updateDoc(doc(db, "products", productId), { status: newStatus });
    alert("✅ 商品狀態已更新！");
  } catch (e) {
    alert("更新失敗：" + e.message);
  }
};

window.openEditProductModal = (productId) => {
  const prod = cachedProductsList.find(p => p.id === productId);
  if (!prod) return;

  document.getElementById('edit-prod-id').value = prod.id;
  document.getElementById('edit-store-title').value = prod.storeTitle || '';
  document.getElementById('edit-product-name').value = prod.productName || '';
  document.getElementById('edit-product-img-url').value = prod.imageUrl || '';

  const container = document.getElementById('edit-options-container');
  container.innerHTML = "";
  (prod.options || []).forEach(opt => window.addEditOptionRow(opt.name, opt.price, !!opt.isOutOfStock));

  document.getElementById('edit-product-modal').classList.remove('hidden');
};

window.closeEditProductModal = () => document.getElementById('edit-product-modal').classList.add('hidden');

const editForm = document.getElementById('edit-product-form');
if (editForm) {
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const productId = document.getElementById('edit-prod-id').value;
    const storeTitle = document.getElementById('edit-store-title').value.trim();
    const productName = document.getElementById('edit-product-name').value.trim();
    const imageUrl = document.getElementById('edit-product-img-url').value.trim();

    const options = [];
    document.querySelectorAll('.edit-option-row').forEach((row, idx) => {
      const nameInput = row.querySelector('.edit-opt-name');
      const priceInput = row.querySelector('.edit-opt-price');
      const stockCheckbox = row.querySelector('.edit-opt-stock');

      if (nameInput && priceInput && nameInput.value.trim() !== "") {
        options.push({
          id: `opt_${idx + 1}`,
          name: nameInput.value.trim(),
          price: Number(priceInput.value),
          isOutOfStock: stockCheckbox ? stockCheckbox.checked : false
        });
      }
    });

    if (options.length === 0) return alert("請至少留一個款式選項！");

    try {
      await updateDoc(doc(db, "products", productId), {
        storeTitle,
        productName,
        imageUrl: imageUrl || "https://via.placeholder.com/300?text=No+Image",
        options
      });
      alert("🎉 修改成功！");
      closeEditProductModal();
    } catch (err) {
      alert("修改失敗：" + err.message);
    }
  });
}

// 4. 代下單
const proxyForm = document.getElementById('proxy-order-form');
if (proxyForm) {
  proxyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.email !== ADMIN_EMAIL) return alert("權限不足！");

    const userVal = document.getElementById('proxy-user-select').value;
    const prodVal = document.getElementById('proxy-product-select').value;
    const qtyVal = Number(document.getElementById('proxy-qty').value);

    if (!userVal || !prodVal) return alert("請選擇團員與商品！");

    const targetUser = cachedUsersMap[userVal] || { uid: userVal, nickname: "團員", email: "" };
    const [pId, optIndexStr] = prodVal.split('___');
    const targetProduct = cachedProductsList.find(p => p.id === pId);
    const targetOption = targetProduct ? targetProduct.options[Number(optIndexStr)] : null;

    if (!targetProduct || !targetOption) return alert("找不到商品規格！");

    const itemObj = {
      storeTitle: targetProduct.storeTitle,
      productName: targetProduct.productName,
      optionName: targetOption.name,
      price: targetOption.price,
      qty: qtyVal
    };

    try {
      await addDoc(collection(db, "orders"), {
        userId: targetUser.uid,
        userName: targetUser.nickname || "團員",
        userEmail: targetUser.email || "",
        items: [itemObj],
        totalAmount: targetOption.price * qtyVal,
        note: "團主手動代下單",
        status: "已下單",
        historyLogs: [{
          action: `團主手動代下單：${targetProduct.productName} (${targetOption.name}) x${qtyVal}`,
          operator: currentUser.email,
          timestamp: new Date().toLocaleString()
        }],
        createdAt: serverTimestamp()
      });

      alert("✅ 成功代下單！");
      proxyForm.reset();
    } catch (err) {
      alert("新增失敗：" + err.message);
    }
  });
}

// 5. 團員名單監聽
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
            🏷️ 暱稱：<span class="text-blue-600 font-extrabold">${nickname}</span>
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

// 6. 刪除/取消訂單
window.cancelOrder = async (orderId) => {
  const targetOrder = cachedOrdersList.find(o => o.id === orderId);
  if (!targetOrder) return;

  const mode = confirm(`要如何處理這筆訂單？\n\n[確定]：改為「已取消」(保留紀錄)\n[取消]：直接『徹底刪除』`);
  const currentUser = auth.currentUser;

  try {
    if (mode) {
      await updateDoc(doc(db, "orders", orderId), {
        status: "已取消",
        historyLogs: arrayUnion({
          action: "團主將訂單標記為 [已取消]",
          operator: currentUser ? currentUser.email : "團主",
          timestamp: new Date().toLocaleString()
        })
      });
      alert("✅ 已更新為「已取消」！");
    } else {
      if (confirm("⚠️ 確定要徹底刪除此訂單嗎？")) {
        await deleteDoc(doc(db, "orders", orderId));
        alert("🗑️ 訂單已刪除！");
      }
    }
  } catch (e) {
    alert("操作失敗：" + e.message);
  }
};

// 7. 智慧合併訂單 (品項並存、同品加總、金額重新 recalculated 需求 3)
window.openMergeModal = () => {
  const sourceSel = document.getElementById('merge-source-select');
  const targetSel = document.getElementById('merge-target-select');

  let html = `<option value="">-- 請選擇訂單 --</option>`;
  cachedOrdersList.forEach(o => {
    const uMatch = cachedUsersMap[o.userId];
    const name = uMatch ? uMatch.nickname : (o.userName || '團員');
    const items = o.items || [{ productName: o.productName, optionName: o.optionName, price: o.price, qty: o.qty }];
    const itemsSummary = items.map(i => `${i.productName}(${i.optionName})x${i.qty}`).join(', ');

    html += `<option value="${o.id}">[${name}] $${o.totalAmount || 0} - ${itemsSummary}</option>`;
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
  if (sourceId === targetId) return alert("來源與目標訂單不能相同！");

  const sourceOrd = cachedOrdersList.find(o => o.id === sourceId);
  const targetOrd = cachedOrdersList.find(o => o.id === targetId);

  const sourceItems = sourceOrd.items || [{ storeTitle: sourceOrd.storeTitle, productName: sourceOrd.productName, optionName: sourceOrd.optionName, price: sourceOrd.price, qty: sourceOrd.qty }];
  const targetItems = [...(targetOrd.items || [{ storeTitle: targetOrd.storeTitle, productName: targetOrd.productName, optionName: targetOrd.optionName, price: targetOrd.price, qty: targetOrd.qty }])];

  // 智慧合併：若品項、規格完全相同則加總 qty，不同則保留新增為多品項
  sourceItems.forEach(sItem => {
    const matchIndex = targetItems.findIndex(tItem => tItem.productName === sItem.productName && tItem.optionName === sItem.optionName);
    if (matchIndex > -1) {
      targetItems[matchIndex].qty += sItem.qty;
    } else {
      targetItems.push({ ...sItem });
    }
  });

  // 重新 recalculate 總金額
  const newTotalAmount = targetItems.reduce((sum, item) => sum + (item.price * item.qty), 0);

  if (!confirm(`確定要將兩筆訂單合併嗎？\n合併後包含 ${targetItems.length} 種品項，總金額：NT$ ${newTotalAmount}`)) return;

  const currentUser = auth.currentUser;

  try {
    await updateDoc(doc(db, "orders", targetId), {
      items: targetItems,
      totalAmount: newTotalAmount,
      historyLogs: arrayUnion({
        action: `合併訂單：併入訂單 ${sourceId.substring(0,5)}，品項已加總並重計總金額為 NT$ ${newTotalAmount}`,
        operator: currentUser ? currentUser.email : "團主",
        timestamp: new Date().toLocaleString()
      })
    });

    await deleteDoc(doc(db, "orders", sourceId));

    alert("🎉 訂單成功合併！所有品項已並存/加總！");
    closeMergeModal();
  } catch(e) {
    alert("合併失敗：" + e.message);
  }
};

// 8. 訂單總覽監聽 & 雙重金額/商品統計總覽 (需求 3, 5)
const orderListContainer = document.getElementById('order-list-container');
const memberSummaryContainer = document.getElementById('member-summary-container');
const grandTotalAmountEl = document.getElementById('grand-total-amount');
const grandTotalQtyEl = document.getElementById('grand-total-qty');

if (orderListContainer) {
  onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snapshot) => {
    cachedOrdersList = [];
    if (snapshot.empty) {
      orderListContainer.innerHTML = "<p class='text-gray-500'>目前尚無下單紀錄。</p>";
      if(grandTotalAmountEl) grandTotalAmountEl.innerText = "NT$ 0";
      if(grandTotalQtyEl) grandTotalQtyEl.innerText = "0 件";
      if(memberSummaryContainer) memberSummaryContainer.innerHTML = "<p class='text-xs text-gray-400'>無統計資料</p>";
      return;
    }

    let grandTotalSum = 0;
    let grandTotalPieces = 0;
    const memberStats = {}; // 個別團員統計對象

    let html = `<div class='space-y-4'>`;

    snapshot.forEach((docSnap) => {
      const order = { id: docSnap.id, ...docSnap.data() };
      cachedOrdersList.push(order);

      const userMatch = cachedUsersMap[order.userId];
      const showNickname = userMatch ? userMatch.nickname : (order.userName || "團員");
      const showEmail = userMatch ? userMatch.email : (order.userEmail || "無 Email");

      // 解析單/多品項
      const itemsList = order.items || [{
        storeTitle: order.storeTitle || '團購',
        productName: order.productName,
        optionName: order.optionName,
        price: order.price || 0,
        qty: order.qty || 1
      }];

      const orderSum = order.totalAmount || itemsList.reduce((sum, i) => sum + (i.price * i.qty), 0);

      // 非取消狀態才計入全團財務統計
      if (order.status !== "已取消") {
        grandTotalSum += orderSum;

        // 計算個人統計
        if (!memberStats[showNickname]) {
          memberStats[showNickname] = { email: showEmail, totalSpent: 0, itemsMap: {} };
        }
        memberStats[showNickname].totalSpent += orderSum;

        itemsList.forEach(i => {
          grandTotalPieces += (i.qty || 1);
          const key = `${i.productName}(${i.optionName})`;
          memberStats[showNickname].itemsMap[key] = (memberStats[showNickname].itemsMap[key] || 0) + i.qty;
        });
      }

      // 品項列表 HTML
      let itemsHtml = `<div class="divide-y border rounded-lg bg-gray-50 overflow-hidden my-2">`;
      itemsList.forEach(i => {
        itemsHtml += `
          <div class="p-2.5 flex justify-between items-center text-xs">
            <div>
              <span class="font-bold text-gray-800">${i.productName}</span>
              <span class="text-blue-600 font-medium"> (${i.optionName})</span>
            </div>
            <div class="font-mono text-gray-700 font-bold">NT$ ${i.price} x ${i.qty} = $${i.price * i.qty}</div>
          </div>
        `;
      });
      itemsHtml += `</div>`;

      // 歷史日誌 Logs
      let logsHtml = '';
      if (order.historyLogs && order.historyLogs.length > 0) {
        logsHtml = `<div class="mt-3 pt-2 border-t border-dashed border-gray-200 space-y-1">
          <div class="text-[11px] font-bold text-gray-500">📜 團主操作履歷 (Logs)：</div>`;
        order.historyLogs.forEach(log => {
          logsHtml += `
            <div class="text-[11px] text-gray-600 bg-gray-50 p-1.5 rounded flex justify-between items-center">
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
              <div class='font-black text-blue-700 text-base'>👤 團員暱稱：${showNickname}</div>
              <div class='text-xs text-gray-500 font-mono'>📧 Email: ${showEmail}</div>
            </div>
            <div class="flex items-center gap-1.5">
              <span class='text-xs bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded'>${order.status || '已下單'}</span>
              <button onclick="cancelOrder('${order.id}')" class="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded border font-bold">
                🚫 取消/刪除
              </button>
            </div>
          </div>

          ${itemsHtml}

          ${order.note ? `<div class='text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-lg mt-2 font-medium'>📝 買家訂單備註：${order.note}</div>` : ''}

          <div class='text-base font-extrabold text-blue-700 mt-2'>
            本單小計：NT$ ${orderSum}
          </div>

          ${logsHtml}
        </div>
      `;
    });

    html += `</div>`;
    orderListContainer.innerHTML = html;

    // 渲染全團總金額與商品總數 (需求 5)
    if(grandTotalAmountEl) grandTotalAmountEl.innerText = `NT$ ${grandTotalSum}`;
    if(grandTotalQtyEl) grandTotalQtyEl.innerText = `${grandTotalPieces} 件`;

    // 渲染個別團員消費統計卡片 (需求 5)
    if(memberSummaryContainer) {
      let memberHtml = "";
      Object.keys(memberStats).forEach(name => {
        const stat = memberStats[name];
        const itemsStr = Object.keys(stat.itemsMap).map(k => `${k} x${stat.itemsMap[k]}`).join(', ');

        memberHtml += `
          <div class="bg-white p-3 rounded-lg border shadow-xs space-y-1">
            <div class="flex justify-between items-center border-b pb-1">
              <span class="font-extrabold text-blue-700 text-sm">👤 ${name}</span>
              <span class="font-black text-blue-600 text-sm">NT$ ${stat.totalSpent}</span>
            </div>
            <div class="text-[11px] text-gray-600 truncate" title="${itemsStr}">
              📦 購買清單：${itemsStr || '無'}
            </div>
          </div>
        `;
      });
      memberSummaryContainer.innerHTML = memberHtml || "<p class='text-xs text-gray-400'>目前無有效消費團員。</p>";
    }
  });
}