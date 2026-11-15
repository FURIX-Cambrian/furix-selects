# 更新到 GitHub（已经配好了，这里是日常用法）

> 现状：仓库已经建好并推上去了，登录凭据也存在 Windows 凭据管理器里。
> 以后你不需要再登录、不需要记命令——改完双击一个文件就行。

- 仓库地址：https://github.com/FURIX-Cambrian/furix-selects
- 直接下载（给朋友）：https://github.com/FURIX-Cambrian/furix-selects/archive/refs/heads/main.zip

## 步骤：改完之后双击 `推送更新.cmd`

1. 双击 `推送更新.cmd`
2. 它会先把这次改动列出来
3. 提示 `这次改了什么？` 时，敲一句话（比如 `修水印位置`），回车
   - 懒得写就直接回车，会用 `更新 2026-11-15 23:02` 这种时间戳
4. 看到「推送完成」就可以关窗口了

它做了三件事：`git add -A` → `git commit` → `git push`，等价于你自己敲：

```bash
git add -A
git commit -m "改了什么"
git push
```

## 它内置的三个防呆

| 情况 | 行为 |
| --- | --- |
| 没有改动 | 直接说「没有新改动，不需要提交」，什么都不做 |
| 混进了照片 / 视频 | 黄字列出文件名，要你输入 `y` 才继续（仓库不该装素材） |
| 没找到 git 或没绑远端 | 红字告诉你差什么，并指向这份文档 |

第一次推送如果弹登录窗口，授权一次就好；之后再也不会问。

## 发一个「版本」给朋友下载

仓库里的源码要会用的人才能跑，朋友直接下 zip 更省事：

1. 打开 https://github.com/FURIX-Cambrian/furix-selects/releases
2. 点 **Draft a new release**
3. **Choose a tag** 选 `v3.8.1`（打过的标签都在）
4. **Release title** 填 `v3.8.1`
5. 把 `FURIX选片台_v3.8.1.zip` 拖到下面的附件框
6. 点 **Publish release**

朋友点开 Releases 就能下，解压双击即可，不用装 Git。

## 打新标签（想让版本号也在仓库里留痕）

双击推送脚本只推代码，不推标签。要发布新版本时，先打标签再推：

```bash
"D:\DSH\_tools\git\bin\git.exe" tag v3.8.2
"D:\DSH\_tools\git\bin\git.exe" push --tags
```

版本号规则：架构级改动 → 大版本（v4.0），新功能 → +0.1（v3.9），纯修复 → 修订位（v3.8.2）。

## 常见问题

**朋友是 Mac？** 让他在终端里对解压出来的文件夹执行一次 `chmod +x 启动选片台.command 停止选片台.command`，之后双击即可。

**要不要把 zip 提交进仓库？** 不要。`.gitignore` 里已经排除了 `*.zip`，发布包只通过 Releases 上传。

**换电脑怎么办？** 装 Git（或把便携版放到 `D:\DSH\_tools\git`），然后：

```bash
git clone https://github.com/FURIX-Cambrian/furix-selects.git
```

**推送失败怎么办？** 看红字提示：`Authentication failed` 就去 Windows「凭据管理器 → Windows 凭据」删掉 `git:https://github.com`，再双击一次脚本重新授权；`rejected` 说明线上有你本地没有的提交，先 `git pull --ff-only` 再推。

**改错了想退回？** `git checkout -- 文件名` 撤销这个文件的未提交改动；已经提交但没推的，`git reset --soft HEAD~1` 退回暂存区。
