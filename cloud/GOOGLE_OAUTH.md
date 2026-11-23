# 段考監考教室系統｜Google 教師登入啟用步驟

## 已由系統完成
- Supabase 專案：`sbdygqnhawjonvdktqly`
- 前端：`cloud/runtime.js` 已提供「使用 Google 帳號登入」（`signInWithOAuth({provider:'google'})`）。
- 前端：`cloud/config.js` 已填入專案 URL 和 **公開** publishable key，但 `enabled:false`，尚不會鎖住現有本機版。
- 兩個待驗證教師 Email 已存在於私有的 `classroom_private.teacher_pending_invites`：
  - `mikibear@tcsh.hlc.edu.tw` — 同步測試班，admin
  - `mikibear418@gmail.com` — 同步測試班，editor
- 用戶完成 Google OAuth 且 Email 經 Supabase 確認後，已有授權觸發器會自動建立 `classroom_members` 資料。
- 資料庫 RLS 限制班級存取；未登入者無法存取資料。

## Google Cloud Console：必要的人工作業
1. 登入 https://console.cloud.google.com/ 建立或選取 Google Cloud 專案。
2. 前往 **Google Auth Platform → Branding**，設定應用程式名稱（段考監考教室系統）、支援電子郵件等基本資料。
3. **Audience** 選擇 **External（外部）**，因為要同時允許學校 Google 帳號和一般 Gmail 帳號登入。若應用程式仍處於 Testing，加入上述兩個 Email 作為 **Test users**。
4. **Clients → Create client → Web application**。設定：
   - Authorized JavaScript origins: `https://mikibear418.github.io`
   - Authorized redirect URIs: `https://sbdygqnhawjonvdktqly.supabase.co/auth/v1/callback`
5. 將 Google Cloud 提供的 **Client ID** 及 **Client Secret** 直接填入 Supabase Dashboard → Authentication → Providers → Google 並啟用。
   - https://supabase.com/dashboard/project/sbdygqnhawjonvdktqly/auth/providers
   - Google Client Secret **只放在 Supabase Dashboard**，不要放進 GitHub、聊天或網頁程式。
6. Supabase Dashboard → Authentication → URL Configuration：
   - Site URL: `https://mikibear418.github.io/exam-classroom-system/`
   - Redirect URLs 加入相同網址，確保末尾 / 正確。
   - https://supabase.com/dashboard/project/sbdygqnhawjonvdktqly/auth/url-configuration

## 將 Google 登入正式啟用
上述步驟完成且 Google Provider 可以正常使用後，編輯 GitHub `cloud/config.js`：
`enabled: false` → `enabled: true`。
此時原本的本機白板會切換為教師登入頁；**未完成 Google Provider 前不要啟用**。
`allowEmailLogin: false` 請保持原樣，避免不必要的 Email SMTP 流程。

## 測試（目前尚未執行）
1. 用學校 Google 帳號 `mikibear@tcsh.hlc.edu.tw` 登入，應看到「同步測試班」admin。
2. 用 `mikibear418@gmail.com` 在另一台電腦或獨立瀏覽器登入，應看到 editor。
3. 第一位老師建立無學生姓名的測試考程；第二位確認雲端同步更新。
4. 驗證未授權的第三個 Google 帳號不能讀取班級資料。
5. 驗證兩位老師衝突修改時不會無聲覆蓋。
6. 實際確認工作流程及權限無誤，才能匯入真實學生資料。

備註：這個階段只完成前端程式與 Supabase 資料庫準備；**Google Cloud OAuth 客戶端與 Supabase Provider 尚未核驗已設定**，跨裝置登入同步也尚未完成測試。
