import { db, auth } from "./auth.js";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
let optionCount = 0;

// 動態增加「新增商品」款式選項列
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
    if (container.querySelectorAll('.option-row').length <= 1) {
      alert("商品至少需要保留一個款式選項！");
      return;
    }
    row.remove();
  });

  container.appendChild(row);
};

window.addOptionRow = addOptionRow;

// 動態增加「編輯 Modal」內部款式選項列
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
    if (container.querySelectorAll('.edit-option-row').length <= 1) {
      alert("商品至少需要保留一個款式選項！");
      return;
    }
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

// 1. 上架商品
const form = document.getElementById('add-product-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.email !== ADMIN_EMAIL) return alert("權限不足！");

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

      if (options.length === 0) {
        alert("請至少填寫一個有效的商品規格！");
        submitBtn.disabled = false;
        return;
      }

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
      submitBtn.innerText = "確認發布商品";
    }
  });
}

// 2. 開團商品監聽與管理列表
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
    if (prod.status === "archived") {
      statusBadge = `<span class="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded font-bold">⚪ 已下架 (前台隱藏)</span>`;
    }

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
            <div class="flex flex-wrap gap-1.5 mt-2">
              ${optionsBadges}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 w-full md:w-auto justify-end">
          <button onclick="openEditProductModal('${prod.id}')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded border font-bold">
            ✏️ 編輯商品全貌
          </button>
          
          ${prod.status === 'archived' ? `
            <button onclick="changeProductStatus('${prod.id}', 'active')" class="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded border font-bold">
              ⬆️ 重新上架
            </button>
          ` : `
            <button onclick="changeProductStatus('${prod.id}', 'archived')" class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded border font-bold">
              📦 整件下架
            </button>
          `}
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
    alert("更新缺貨狀態失敗：" + e.message);
  }
};

window.changeProductStatus = async (productId, newStatus) => {
  try {
    await updateDoc(doc(db, "products", productId), { status: newStatus });
    alert("✅ 商品狀態已更新！");
  } catch (e) {
    alert("更新狀態失敗：" + e.message);
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

  (prod.options || []).forEach(opt => {
    window.addEditOptionRow(opt.name, opt.price, !!opt.isOutOfStock);
  });

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
      alert("🎉 商品與缺貨狀態更新成功！");
      closeEditProductModal();
    } catch (err) {
      alert("修改失敗：" + err.message);
    }
  });
}

// 3. 代下單
const proxyForm = document.getElementById('proxy-order-form');
if (proxyForm) {
  proxyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.email !== ADMIN_EMAIL) return alert("權限不足！");

    const userVal = document.getElementById('proxy-user-select').value;
    const prodVal = document.getElementById('proxy-product-select').value;
    const qtyVal = Number(document.getElementById('proxy-qty').value);

    if (!userVal || !prodVal) return alert("請完整選擇團員與商品選項！");

    const targetUser = cachedUsersMap[userVal] || { uid: userVal, nickname: "團員", email: "團主新增" };
    const [pId, optIndexStr] = prodVal.split('___');
    const targetProduct = cachedProductsList.find(p => p.id === pId);
    const targetOption = targetProduct ? targetProduct.options[Number(optIndexStr)] : null;

    if (!targetProduct || !targetOption) return alert("找不到商品規格！");

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
        note: "團主手動代下單",
        status: "已下單",
        historyLogs: [{
          action: `團主手動新增/代下單：${targetProduct.productName} (${targetOption.name}) x${qtyVal}`,
          operator: currentUser.email,
          timestamp: new Date().toLocaleString()
        }],
        createdAt: serverTimestamp()
      });

      alert("✅ 成功新增訂單！");
      proxyForm.reset();
    } catch (err) {
      alert("新增失敗：" + err.message);
    }
  });
}

// 4. 團員名單監聽
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

// 5. 編輯訂單 (支援修改備註)
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

  const newNote = prompt("修改【買家訂單備註】：", targetOrder.note || "");
  if (newNote === null) return;

  const newStatus = prompt("修改【訂單狀態】(例如: 已下單 / 已付款 / 已取消)：", targetOrder.status || "已下單");
  if (newStatus === null) return;

  const noteLog = prompt("請輸入變更歷史說明（將記在日誌中）：", "團主修改細項");

  const currentUser = auth.currentUser;

  try {
    await updateDoc(doc(db, "orders", orderId), {
      productName: newProductName.trim(),
      optionName: newOptionName.trim(),
      price: Number(newPrice),
      qty: Number(newQty),
      note: newNote.trim(),
      status: newStatus.trim(),
      historyLogs: arrayUnion({
        action: `編輯訂單: ${newProductName} (${newOptionName}) x${newQty}, 備註: ${newNote || '無'}, 狀態: ${newStatus} (說明: ${noteLog || '無'})`,
        operator: currentUser ? currentUser.email : "團主",
        timestamp: new Date().toLocaleString()
      })
    });
    alert("✅ 訂單資料已更新！");
  } catch (err) {
    alert("修改失敗：" + err.message);
  }
};

// 6. 取消/刪除訂單
window.cancelOrder = async (orderId) => {
  const targetOrder = cachedOrdersList.find(o => o.id === orderId);
  if (!targetOrder) return;

  const mode = confirm(`要如何處理這筆【${targetOrder.productName}】訂單？\n\n[確定]：將狀態改為「已取消」(保留紀錄)\n[取消]：直接將此訂單刪除`);

  const currentUser = auth.currentUser;

  try {
    if (mode) {
      await updateDoc(doc(db, "orders", orderId), {
        status: "已取消",
        historyLogs: arrayUnion({
          action: "團主將訂單狀態標記為 [已取消]",
          operator: currentUser ? currentUser.email : "團主",
          timestamp: new Date().toLocaleString()
        })
      });
      alert("✅ 訂單已更新為「已取消」！");
    } else {
      if (confirm("⚠️ 確定要直接從資料庫『徹底刪除』這筆訂單嗎？（無法復原）")) {
        await deleteDoc(doc(db, "orders", orderId));
        alert("🗑️ 訂單已成功刪除！");
      }
    }
  } catch (e) {
    alert("操作失敗：" + e.message);
  }
};

// 7. 合併訂單彈窗與執行
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

  if (!confirm(`確定要把【${sourceOrd.productName}-${sourceOrd.optionName} x${sourceOrd.qty}】\n合併併入【${targetOrd.productName}-${targetOrd.optionName} x${targetOrd.qty}】嗎？`)) return;

  const currentUser = auth.currentUser;
  const newQty = (targetOrd.qty || 1) + (sourceOrd.qty || 1);

  try {
    await updateDoc(doc(db, "orders", targetId), {
      qty: newQty,
      historyLogs: arrayUnion({
        action: `合併訂單：併入 (${sourceOrd.productName} x${sourceOrd.qty})，數量加總為 ${newQty}`,
        operator: currentUser ? currentUser.email : "團主",
        timestamp: new Date().toLocaleString()
      })
    });

    await deleteDoc(doc(db, "orders", sourceId));

    alert("🎉 訂單合併成功！");
    closeMergeModal();
  } catch(e) {
    alert("合併失敗：" + e.message);
  }
};

// 8. 訂單總覽監聽與渲染 (顯眼呈現象買家備註)
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
            <div class="flex items-center gap-1.5">
              <span class='text-xs bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded'>${order.status || '已下單'}</span>
              <button onclick="editOrderFull('${order.id}')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded border font-bold">
                ✏️ 修改細項/備註
              </button>
              <button onclick="cancelOrder('${order.id}')" class="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded border font-bold">
                🚫 取消/刪除
              </button>
            </div>
          </div>
          <div class='text-xs font-semibold text-blue-800 bg-blue-50 inline-block px-2 py-0.5 rounded mb-1'>
            📢 ${order.storeTitle || '未分組團購'}
          </div>
          <div class='text-sm text-gray-800'>
            <strong>商品：</strong>${order.productName || ''} - <span class="text-blue-600 font-bold">${order.optionName || ''}</span> x${order.qty || 1}
          </div>
          
          ${order.note ? `<div class='text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-lg mt-2 font-medium'>📝 買家訂單備註：${order.note}</div>` : ''}

          <div class='text-sm text-gray-800 mt-1.5'>
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