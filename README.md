# 东三路派出所 · 警社联动诉求服务

山东合能科技有限责任公司 · **1027 基础修订版**。

本仓库收录 2026 年 11 月 17 日最后交付的完整本地演示页面。该版本以 2026 年 10 月 27 日的原始 Demo 为基础修订，保留原有界面风格和功能，并调整群众提报、单位办理、分析大屏与流转记录。

## 运行方式

直接用 Chrome 或 Edge 打开仓库根目录的 **`单文件版.html`** 即可演示。

开发时也可打开 **`index.html`**，并保持 `css/`、`js/`、`vendor/` 与入口文件的相对位置。项目运行不需要安装 npm 依赖或执行构建。

如需通过本机 HTTP 服务预览，可在仓库根目录执行：

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

然后访问 `http://127.0.0.1:8000/`。不同文件路径、浏览器和 HTTP 来源可能使用不同的本地存储空间。

## 当前业务流程

1. 群众选择公安、社区或物业，再选择具体接收单位，填写描述及地址/位置后提交。
2. 群众提报时不选择问题类型；新事项进入所选单位的待接收列表。
3. 接收单位根据描述执行“接收并分类”，添加办理记录，填写结果并自行办结。
4. 公安、社区、物业分别办理群众直接上报给本单位的事项。
5. 地图、标点、筛选和统计统一放在“分析大屏”；点击“返回主页”回到工作台。
6. “流转记录”一级列表按事项聚合，每个事项只显示一条最新动态，并按最新流转时间倒序排列；详情保留完整历史。

系统同时包含组织、角色、人员、二维码入口、自定义字段和统计报表配置。具体演示步骤及旧数据兼容说明见 [`使用说明.txt`](使用说明.txt)。

## 目录与源码

| 路径 | 内容 |
| --- | --- |
| `index.html` | 分文件页面入口 |
| `单文件版.html` | 原始交付的独立 HTML，内嵌样式和脚本 |
| `js/app.js` | 应用状态、群众提报、岗位切换及办理操作 |
| `js/admin.js` | 组织、角色、人员、入口及自定义配置 |
| `js/domain.js`、`js/policy.js` | 事项数据处理与本地演示权限规则 |
| `js/legacy-core.js` | 工作台、事项详情及流转记录等基础界面 |
| `js/geo-analytics.js`、`js/geolocation.js` | 地图、大屏、报表及定位 |
| `js/local-storage.js`、`js/sync-merge.js` | 本机保存适配与数据合并辅助模块 |
| `js/vector-canvas.js` | Canvas 地图兼容渲染运行包 |
| `css/` | 完整页面样式 |
| `vendor/` | Leaflet、MapLibre、二维码及矢量瓦片依赖、图片与许可证 |
| `vendor/vector-canvas/renderer.js` | Canvas 地图渲染器源文件 |
| `vendor/vector-canvas/packages/` | 矢量瓦片解码依赖源码及版本信息 |
| `favicon.svg` | 页面图标 |
| `使用说明.txt` | 最终交付时的使用说明 |
| `验证说明.txt` | 最终交付时的验证记录及验证范围 |
| `SOURCE_MANIFEST.json` | 43 个原始交付文件的大小与 SHA-256 校验清单 |

## 运行边界

- 这是浏览器本地演示版，数据保存在当前浏览器的 `localStorage`，没有服务端数据库或跨设备同步。
- 角色与人员切换用于演示，正式多用户使用需要另行建设登录、服务端鉴权和共享后台。
- 真实地图底图依赖网络。地图优先使用 WebGL，兼容模式使用 Canvas 2D 渲染。
- 手机定位需要用户授权，效果取决于设备、浏览器和运行环境；失败时可填写文字地址或手动选点。
- 供另一部手机扫码使用时，需要手机可访问的网页地址；多设备共同办理还需要共享后台。
- 浏览器数据清理、文件移动或来源变化可能影响已有本地数据读取，请及时使用页面内的 JSON 备份导出。

## 版本与校验

原始交付包：`警社联动_东三路派出所_1027基础修订版_完整页面包.zip`。

ZIP SHA-256：

```text
cc6e07b0b1d62f4b71db1c9fd7ffc74428a8883f647207e5dc017284c7b456a2
```

`单文件版.html` 与独立交付的 `警社联动_东三路派出所_1027基础修订版.html` 字节一致，SHA-256 为：

```text
9e9b74ddc7d7d13de2d65d1200bf69ddcf9f6046a93109aad8986769d627b838
```

入库保留全部 43 个原始文件，新增本 README、`.gitignore` 和校验清单。可执行以下命令核对原始交付文件：

```bash
python3 - <<'PY'
import hashlib
import json
from pathlib import Path

manifest = json.loads(Path('SOURCE_MANIFEST.json').read_text(encoding='utf-8'))
for entry in manifest['files']:
    data = Path(entry['path']).read_bytes()
    assert len(data) == entry['size_bytes'], entry['path']
    assert hashlib.sha256(data).hexdigest() == entry['sha256'], entry['path']
print(f"已核对 {len(manifest['files'])} 个原始交付文件")
PY
```

`验证说明.txt` 保留此前交付时的验证记录。本次入库主要核对文件完整性、资源引用和脚本语法；此前记录不代表本次重新完成了手机 GPS 或在线地图等实机验证。

## 第三方许可证

第三方库的许可证、版本信息及源码注释随 `vendor/` 一并保留。使用或分发相关依赖时，应遵守其各自许可证。
