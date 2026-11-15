# 第一次把它传到 GitHub（纯小白版）

> 目标：让朋友能下载到这个工具。全程用鼠标，不敲命令。

## 第 1 步：注册 GitHub

打开 https://github.com → Sign up → 填邮箱、密码、用户名（用户名会出现在链接里，用英文）。

## 第 2 步：装 GitHub Desktop

下载：https://desktop.github.com → 双击安装 → 打开后点 **Sign in to GitHub.com**，在浏览器里授权登录。

## 第 3 步：把这个文件夹变成仓库

1. 菜单 **File → Add Local Repository…**
2. 选择这个文件夹（`FURIX选片台`）
3. 如果提示 "not a Git repository"，点它给的 **create a repository** 链接即可（仓库已经初始化过，一般会直接加进来）

## 第 4 步：发布公开/私有仓库

1. 右上角点 **Publish repository**
2. Name 填 `furix-selects`（或任意英文名）
3. 想公开就取消勾选 **Keep this code private**
4. 点 **Publish repository**

完成。仓库地址类似 `https://github.com/你的用户名/furix-selects`，发这个链接给朋友即可。

## 第 5 步：以后改了怎么更新

在 GitHub Desktop 里：

1. 左下 **Summary** 填一句说明（比如 `修复水印位置`）
2. 点 **Commit to main**
3. 点上方 **Push origin**

## 第 6 步：发一个"版本"给朋友下载

1. 打开仓库网页 → 右侧 **Releases** → **Draft a new release**
2. Tag 填 `v3.7` → 标题填 `v3.7`
3. 把 `FURIX选片台_v3.7.zip` 拖到附件区 → **Publish release**

朋友不用装 Git，直接下 zip 解压就能用。

## 常见问题

**朋友是 Mac？** 让他双击 `启动选片台.command`；第一次可能要在终端 `chmod +x` 一次（README 里写了）。

**要不要把 zip 也提交进仓库？** 不要。zip 放 Releases，仓库只放源码，否则每次发版仓库都会变大一份。

**换电脑怎么办？** 新电脑装 GitHub Desktop，登录同一账号 → Clone repository → 选这个仓库。