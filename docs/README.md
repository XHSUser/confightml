# 配置平台网页端

`docs/` 是可直接部署到 GitHub Pages 的静态网页版本。它使用手机浏览器调用 GitHub Contents API，支持：

- 管理多个 GitHub 仓库连接
- 读取、创建、编辑和删除应用 JSON 配置
- 应用总开关、版本、支付套餐、广告位和功能开关
- 其他字段、完整 JSON 文本配置、预览和请求测试
- 连接配置导入与导出

网页端不包含 IPA 打包或安装功能。

## 部署

1. 将仓库推送到 GitHub。
2. 在仓库的 **Settings → Pages** 中选择 **Deploy from a branch**。
3. 选择需要发布的分支，并将目录设为 `/docs`。
4. 打开 GitHub Pages 地址，在手机浏览器中使用。

首次使用时点击“连接管理”，填写 GitHub Fine-grained token 和仓库地址（例如 `owner/repo`）。令牌只保存在当前浏览器的本地存储中，网页不会把令牌上传到其他服务器。

建议令牌只授予目标私有仓库的 Contents 读写权限，并为 GitHub Pages 配置 HTTPS 地址后再使用。
