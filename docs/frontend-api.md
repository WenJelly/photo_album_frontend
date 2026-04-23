# Photo Album Frontend API 文档

本文档面向前端开发，基于当前仓库实际代码整理，不是纯 `.api` 文件转写。

更新时间：2026-04-23

## 1. 文档范围

当前后端对前端实际暴露的接口如下：

1. `POST /api/user/login`
2. `POST /api/user/register`
3. `POST /api/user/get/detail`
4. `POST /api/user/update`
5. `POST /api/admin/user/update`
6. `POST /api/picture/list`
7. `POST /api/picture/vo`
8. `POST /api/picture/upload`
9. `POST /api/picture/upload/url`
10. `POST /api/picture/delete`
11. `POST /api/picture/review`

## 2. 全局约定

### 2.1 Base URL

服务本身没有写死域名，前端只需要在部署环境中拼接服务地址。

接口路径前缀固定为：

```text
/api
```

管理员用户资料修改接口路径前缀为：

```text
/api/admin
```

### 2.2 鉴权方式

需要登录的接口统一使用：

```http
Authorization: Bearer <token>
```

`token` 由登录接口 `/api/user/login` 返回。

### 2.3 通用响应结构

所有接口统一返回：

```json
{
  "code": 200,
  "message": "成功",
  "data": {}
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | `number` | 业务码，当前与 HTTP 状态码保持一致 |
| `message` | `string` | 后端返回的提示信息 |
| `data` | `object | array | null` | 成功时的业务数据；部分无返回体接口会省略 |

### 2.4 常见状态码

| HTTP / code | 含义 |
| --- | --- |
| `200` | 成功 |
| `400` | 请求参数错误 |
| `401` | 未登录、token 非法、token 失效 |
| `403` | 无权限 |
| `404` | 资源不存在 |
| `409` | 资源冲突，例如邮箱已注册 |
| `500` | 服务端异常 |

错误返回示例：

```json
{
  "code": 400,
  "message": "id 必须是正整数"
}
```

### 2.5 ID 类型约定

所有对前端暴露的 ID 都按字符串处理，包括但不限于：

- `user.id`
- `picture.id`
- `picture.userId`
- `picture.reviewerId`

前端不要把这些字段当成 JS number 使用，避免大整数精度问题。

### 2.6 时间格式约定

后端返回时间字段统一为字符串，格式：

```text
YYYY-MM-DD HH:mm:ss
```

例如：

```text
2026-04-23 14:30:45
```

### 2.7 图片审核状态约定

| 值 | 含义 |
| --- | --- |
| `0` | 待审核 |
| `1` | 审核通过 |
| `2` | 审核拒绝 |

### 2.8 图片压缩参数 `compressPictureType`

多个图片接口都支持传：

```json
{
  "compressPictureType": {
    "compressType": 0,
    "cutWidth": 0,
    "CutHeight": 0
  }
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `compressType` | `number` | `0` 不压缩；`1` 返回后端计算出的缩略图地址；`2` 返回居中裁剪图地址 |
| `cutWidth` | `number` | `compressType=2` 时必填，必须为正整数 |
| `CutHeight` | `number` | `compressType=2` 时必填，必须为正整数 |

后端行为：

1. `compressType=0` 时，`thumbnailUrl` 直接等于原图 `url`
2. `compressType=1` 时：
   - 图片大小 `<= 2MB`，`thumbnailUrl` 仍然可能等于原图
   - 图片大小 `> 2MB`，后端会按图片大小生成 COS 压缩参数地址
3. `compressType=2` 时，后端返回居中裁剪后的 COS 参数地址

注意：

1. `thumbnailUrl` 是运行时计算字段，不是数据库存储字段
2. `cutWidth` 和 `CutHeight` 大小写当前后端定义不一致，前端应严格按后端字段名发送：
   - 宽度字段：`cutWidth`
   - 高度字段：`CutHeight`

## 3. 数据结构

### 3.1 UserDetail

用于图片返回中的上传者简要信息。

```json
{
  "id": "123",
  "userName": "张三",
  "userAvatar": "https://...",
  "userProfile": "摄影爱好者",
  "userRole": "user"
}
```

### 3.2 PictureResponse

单张图片返回结构：

```json
{
  "id": "101",
  "url": "https://cos.example.com/public/1/2026-04-23_xxx.jpg",
  "name": "海边日落",
  "introduction": "傍晚拍摄",
  "category": "风景",
  "tags": ["日落", "海边"],
  "picSize": 3145728,
  "picWidth": 1920,
  "picHeight": 1080,
  "picScale": 1.7777777778,
  "picFormat": "jpg",
  "userId": "1",
  "user": {
    "id": "1",
    "userName": "张三",
    "userAvatar": "https://...",
    "userProfile": "摄影爱好者",
    "userRole": "user"
  },
  "createTime": "2026-04-23 10:00:00",
  "editTime": "2026-04-23 10:00:00",
  "updateTime": "2026-04-23 10:00:00",
  "reviewStatus": 1,
  "reviewMessage": "",
  "reviewerId": "2",
  "reviewTime": "2026-04-23 10:05:00",
  "thumbnailUrl": "https://cos.example.com/...",
  "picColor": "#A1B2C3",
  "viewCount": 12,
  "likeCount": 0
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 图片 ID |
| `url` | `string` | 原图地址 |
| `name` | `string` | 图片名称 |
| `introduction` | `string` | 简介，可能为空字符串 |
| `category` | `string` | 分类，可能为空字符串 |
| `tags` | `string[]` | 标签数组 |
| `picSize` | `number` | 文件大小，单位字节 |
| `picWidth` | `number` | 图片宽度 |
| `picHeight` | `number` | 图片高度 |
| `picScale` | `number` | 宽高比 |
| `picFormat` | `string` | 图片格式，如 `jpg` / `png` / `webp` |
| `userId` | `string` | 上传者用户 ID |
| `user` | `UserDetail` | 上传者摘要信息 |
| `createTime` | `string` | 创建时间 |
| `editTime` | `string` | 编辑时间 |
| `updateTime` | `string` | 更新时间 |
| `reviewStatus` | `number` | 审核状态：`0/1/2` |
| `reviewMessage` | `string` | 审核说明 |
| `reviewerId` | `string` | 审核人 ID，没有时为空字符串 |
| `reviewTime` | `string` | 审核时间，没有时为空字符串 |
| `thumbnailUrl` | `string` | 缩略图/压缩图地址 |
| `picColor` | `string` | 主色，格式示例 `#A1B2C3` |
| `viewCount` | `number` | 浏览次数 |
| `likeCount` | `number` | 点赞数，当前后端只返回，不提供变更接口 |

### 3.3 PicturePageResponse

```json
{
  "pageNum": 1,
  "pageSize": 10,
  "total": 128,
  "list": []
}
```

### 3.4 LoginResponse

```json
{
  "token": "xxx",
  "id": "1",
  "userEmail": "test@example.com",
  "userName": "用户",
  "userAvatar": "",
  "userProfile": "",
  "userRole": "user",
  "createTime": "2026-04-23 10:00:00",
  "updateTime": "2026-04-23 10:00:00"
}
```

### 3.5 DetailUserResponse

```json
{
  "id": "1",
  "userName": "用户",
  "userEmail": "test@example.com",
  "userAvatar": "",
  "userProfile": "",
  "userRole": "user",
  "createTime": "2026-04-23 10:00:00",
  "updateTime": "2026-04-23 10:00:00",
  "pictureCount": 12,
  "approvedPictureCount": 10,
  "pendingPictureCount": 1,
  "rejectedPictureCount": 1
}
```

## 4. 接口清单总览

| 接口 | 方法 | 是否登录 | 是否管理员 | 作用 |
| --- | --- | --- | --- | --- |
| `/api/user/login` | `POST` | 否 | 否 | 用户登录并获取 token |
| `/api/user/register` | `POST` | 否 | 否 | 用户注册 |
| `/api/user/get/detail` | `POST` | 是 | 否 | 获取当前用户或指定用户详情和作品统计 |
| `/api/user/update` | `POST` | 是 | 否 | 修改自己的资料 |
| `/api/admin/user/update` | `POST` | 是 | 是 | 管理员修改任意用户资料和角色 |
| `/api/picture/list` | `POST` | 否 | 否 | 获取公开图片分页列表 |
| `/api/picture/vo` | `POST` | 是 | 否 | 获取单张图片详情，用于预览 |
| `/api/picture/upload` | `POST` | 是 | 否 | 本地文件上传图片；传 `id` 时可更新已有图片 |
| `/api/picture/upload/url` | `POST` | 是 | 否 | 通过远程 URL 上传图片；传 `id` 时可更新已有图片 |
| `/api/picture/delete` | `POST` | 是 | 否 | 删除图片，仅上传者或管理员可删 |
| `/api/picture/review` | `POST` | 是 | 是 | 管理员审核图片 |

## 5. 详细接口说明

### 5.1 用户登录

**接口**

```http
POST /api/user/login
Content-Type: application/json
```

**作用**

用户使用邮箱和密码登录，成功后返回 JWT token 及用户基础信息。

**请求体**

```json
{
  "userEmail": "test@example.com",
  "userPassword": "123456"
}
```

**字段说明**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `userEmail` | `string` | 是 | 邮箱 |
| `userPassword` | `string` | 是 | 密码明文 |

**成功返回**

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "token": "jwt-token",
    "id": "1",
    "userEmail": "test@example.com",
    "userName": "用户",
    "userAvatar": "",
    "userProfile": "",
    "userRole": "user",
    "createTime": "2026-04-23 10:00:00",
    "updateTime": "2026-04-23 10:00:00"
  }
}
```

**后端行为**

1. 按邮箱查用户
2. 账号不存在或已删除时返回 `404`
3. 密码错误返回 `401`
4. 登录成功后生成 JWT，`userId` 会写入 token claims

**常见失败**

| 场景 | code | message |
| --- | --- | --- |
| 账号不存在 | `404` | `账号不存在` |
| 密码错误 | `401` | `密码错误` |
| 生成 token 失败 | `500` | `生成 Token 失败` |

**前端注意**

1. 登录成功后应保存 `token`
2. 后续登录态接口统一传 `Authorization: Bearer <token>`

---

### 5.2 用户注册

**接口**

```http
POST /api/user/register
Content-Type: application/json
```

**作用**

注册普通用户账号。

**请求体**

```json
{
  "userEmail": "test@example.com",
  "userPassword": "123456",
  "userCheckPassword": "123456"
}
```

**字段说明**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `userEmail` | `string` | 是 | 邮箱 |
| `userPassword` | `string` | 是 | 密码 |
| `userCheckPassword` | `string` | 是 | 二次确认密码 |

**成功返回**

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "id": "12"
  }
}
```

**后端行为**

1. 两次密码必须一致
2. 邮箱不能重复
3. 注册成功后默认：
   - `userName = "用户"`
   - `userRole = "user"`
4. 返回新用户 ID

**常见失败**

| 场景 | code | message |
| --- | --- | --- |
| 两次密码不一致 | `400` | `两次输入的密码不一致` |
| 邮箱已注册 | `409` | `邮箱已注册` |
| 数据库异常 | `500` | `数据库查询异常` |

---

### 5.3 获取用户详情

**接口**

```http
POST /api/user/get/detail
Authorization: Bearer <token>
Content-Type: application/json
```

**作用**

获取用户详情及该用户作品统计。

**请求体**

三种常用方式：

1. 查询当前登录用户：

```json
{}
```

2. 按用户 ID 查询：

```json
{
  "id": "1"
}
```

3. 按邮箱查询：

```json
{
  "userEmail": "test@example.com"
}
```

**字段说明**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | 否 | 指定用户 ID，必须为正整数串 |
| `userEmail` | `string` | 否 | 指定用户邮箱 |

**查询优先级**

1. 如果传了 `id`，优先按 `id` 查询
2. 否则如果传了 `userEmail`，按邮箱查询
3. 如果都不传，默认返回当前登录用户

**成功返回**

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "id": "1",
    "userName": "用户",
    "userEmail": "test@example.com",
    "userAvatar": "",
    "userProfile": "",
    "userRole": "user",
    "createTime": "2026-04-23 10:00:00",
    "updateTime": "2026-04-23 10:00:00",
    "pictureCount": 12,
    "approvedPictureCount": 10,
    "pendingPictureCount": 1,
    "rejectedPictureCount": 1
  }
}
```

**后端行为**

1. 必须登录
2. 只返回未删除用户
3. `pictureCount` 等统计只统计该用户未删除作品

**常见失败**

| 场景 | code | message |
| --- | --- | --- |
| 未登录 | `401` | `请先登录` |
| `id` 非法 | `400` | `id 必须是正整数` |
| 用户不存在 | `404` | `用户不存在` |

---

### 5.4 修改自己的资料

**接口**

```http
POST /api/user/update
Authorization: Bearer <token>
Content-Type: application/json
```

**作用**

当前登录用户修改自己的资料。

**请求体**

```json
{
  "id": "1",
  "userName": "新的昵称",
  "userEmail": "new@example.com",
  "userPassword": "new-password",
  "userAvatar": "https://cdn.example.com/avatar.jpg",
  "userProfile": "新的简介"
}
```

**字段说明**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | 是 | 必须等于当前登录用户 ID |
| `userName` | `string` | 否 | 昵称，长度不能超过 256 个字符 |
| `userEmail` | `string` | 否 | 新邮箱，不能与其他未删除用户重复 |
| `userPassword` | `string` | 否 | 新密码，后端会重新加密 |
| `userAvatar` | `string` | 否 | 头像地址，长度不能超过 1024 |
| `userProfile` | `string` | 否 | 个人简介，长度不能超过 512 个字符 |

**成功返回**

返回更新后的 `DetailUserResponse`。

**后端行为**

1. `id` 必须是当前登录用户自己
2. 至少要更新一个字段
3. 密码字段如果有值，会被重新加密保存
4. 更新完成后会返回最新的用户统计

**常见失败**

| 场景 | code | message |
| --- | --- | --- |
| 未登录 | `401` | `请先登录` |
| 修改他人资料 | `403` | `只能修改自己的信息` |
| 未传任何可更新字段 | `400` | `至少更新一个字段` |
| 邮箱冲突 | `409` | `邮箱已注册` |

**前端注意**

1. 这里不是“按 token 自动识别更新自己”，而是显式要求传 `id`
2. 前端不要把别人的 `id` 直接传到这里

---

### 5.5 管理员修改用户资料

**接口**

```http
POST /api/admin/user/update
Authorization: Bearer <token>
Content-Type: application/json
```

**作用**

管理员修改任意用户资料，并且可以改用户角色。

**权限要求**

必须是管理员账号。

**请求体**

```json
{
  "id": "2",
  "userName": "管理员修改后的昵称",
  "userEmail": "updated@example.com",
  "userPassword": "new-password",
  "userAvatar": "https://cdn.example.com/avatar.jpg",
  "userProfile": "管理员修改后的简介",
  "userRole": "admin"
}
```

**字段说明**

和普通用户更新基本一致，额外多一个：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `userRole` | `string` | 否 | 只能是 `user` 或 `admin` |

**成功返回**

返回更新后的 `DetailUserResponse`。

**常见失败**

| 场景 | code | message |
| --- | --- | --- |
| 未登录 | `401` | `请先登录` |
| 非管理员 | `403` | `仅管理员可访问` |
| 用户不存在 | `404` | `用户不存在` |
| 角色非法 | `400` | `userRole 只能是 user 或 admin` |

---

### 5.6 获取公开图片列表

**接口**

```http
POST /api/picture/list
Content-Type: application/json
```

**作用**

获取公开可见的图片分页列表。

**重要说明**

这个接口只返回：

1. `isDelete = 0`
2. `reviewStatus = 1`

也就是说，无论前端有没有传审核状态，公开列表都只会返回已审核通过的图片。

**请求体示例**

```json
{
  "name": "海边",
  "category": "风景",
  "tags": ["日落", "海边"],
  "userId": "1",
  "searchText": "晚霞",
  "editTimeStart": "2026-04-01",
  "editTimeEnd": "2026-04-23",
  "compressPictureType": {
    "compressType": 1
  },
  "pageNum": 1,
  "pageSize": 20
}
```

**可用筛选字段**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 图片 ID |
| `name` | `string` | 图片名称模糊匹配 |
| `category` | `string` | 分类精确匹配 |
| `tags` | `string[]` | 标签模糊匹配，可传多个 |
| `picSize` | `number` | 图片大小精确匹配 |
| `picWidth` | `number` | 宽度精确匹配 |
| `picHeight` | `number` | 高度精确匹配 |
| `picScale` | `number` | 宽高比精确匹配 |
| `picFormat` | `string` | 格式精确匹配 |
| `userId` | `string` | 上传者 ID |
| `searchText` | `string` | 同时匹配 `name` 和 `introduction` |
| `editTimeStart` | `string` | 编辑时间起点，支持 `YYYY-MM-DD` 或 `YYYY-MM-DD HH:mm:ss` |
| `editTimeEnd` | `string` | 编辑时间终点，支持 `YYYY-MM-DD` 或 `YYYY-MM-DD HH:mm:ss` |
| `compressPictureType` | `object` | 缩略图策略 |
| `pageNum` | `number` | 页码，默认 `1` |
| `pageSize` | `number` | 每页数量，默认 `10`，最大 `300` |

**无效或无意义字段**

以下字段虽然在请求结构里存在，但在公开列表接口里不会生效：

- `reviewStatus`
- `reviewMessage`
- `reviewerId`

原因是公开列表接口会强制只查 `reviewStatus=1`。

**成功返回**

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "pageNum": 1,
    "pageSize": 20,
    "total": 128,
    "list": [
      {
        "id": "101",
        "url": "https://...",
        "thumbnailUrl": "https://...",
        "user": {
          "id": "1",
          "userName": "张三",
          "userAvatar": "https://...",
          "userProfile": "",
          "userRole": "user"
        }
      }
    ]
  }
}
```

**后端行为**

1. 分页按 `id desc` 排序
2. 返回值中的 `user` 已经带上传者摘要，不需要前端再逐条请求用户信息
3. 空结果时返回：
   - `total = 0`
   - `list = []`

**常见失败**

| 场景 | code | message |
| --- | --- | --- |
| `id` 非法 | `400` | `id 必须是正整数` |
| `userId` 非法 | `400` | `userId 必须是正整数` |
| `pageSize > 300` | `400` | `pageSize 不能超过 300` |
| 时间格式错误 | `400` | `editTimeStart 格式错误` / `editTimeEnd 格式错误` |
| 压缩参数非法 | `400` | `compressType 只能是 0、1、2` |

---

### 5.7 获取单张图片详情

**接口**

```http
POST /api/picture/vo
Authorization: Bearer <token>
Content-Type: application/json
```

**作用**

获取单张图片详情，通常用于预览页。

**请求体**

```json
{
  "id": "101",
  "compressPictureType": {
    "compressType": 1
  }
}
```

**字段说明**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | 是 | 图片 ID |
| `compressPictureType` | `object` | 否 | 控制 `thumbnailUrl` 的返回形式 |

**访问权限规则**

虽然这个接口本身要求登录，但图片内容是否能看，还要再走业务判断：

1. 审核通过的图片，任何已登录用户都能看
2. 未审核通过的图片，只有：
   - 图片拥有者
   - 管理员
   可以看

**成功返回**

返回 `PictureResponse`。

**副作用**

每成功查看一次，后端会自动把该图片的 `viewCount + 1`。

**常见失败**

| 场景 | code | message |
| --- | --- | --- |
| 未登录 | `401` | `请先登录` |
| 图片不存在 | `404` | `图片不存在` |
| 图片暂不可查看 | `403` | `当前图片暂不可查看` |

**前端注意**

1. 这个接口不是公开接口，必须带 token
2. 如果前端要做预览访问统计，这个接口已经会自动累加浏览数，不要重复单独记一次

---

### 5.8 本地文件上传图片

**接口**

```http
POST /api/picture/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**作用**

上传本地图片文件。也支持通过传 `id` 更新已有图片。

**表单字段**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `file` | `file` | 是 | 图片文件 |
| `id` | `string` | 否 | 如果传入，表示更新已有图片 |
| `picName` | `string` | 否 | 图片名；不传时取原始文件名 |
| `introduction` | `string` | 否 | 简介 |
| `category` | `string` | 否 | 分类 |
| `tags` | `string` | 否 | 支持两种格式：JSON 数组字符串或逗号分隔字符串 |

`tags` 示例：

```text
["日落","海边"]
```

或者：

```text
日落,海边
```

**文件限制**

| 项目 | 限制 |
| --- | --- |
| 文件类型 | `jpg` / `jpeg` / `png` / `webp` |
| 文件大小 | 最大 `30MB` |

**成功返回**

返回 `PictureResponse`。

**创建与更新行为**

1. 不传 `id`：新建图片
2. 传 `id`：更新已有图片
3. 更新已有图片时，只有图片上传者本人或管理员可以操作
4. 更新时如果 `introduction/category/tags` 未传，后端会沿用旧值
5. 更新时图片文件本身会被新文件替换

**审核状态行为**

1. 普通用户上传或更新图片：
   - `reviewStatus = 0`
   - `reviewMessage = "待审核"`
2. 管理员上传或更新图片：
   - 自动通过
   - `reviewStatus = 1`
   - `reviewMessage = "管理员上传自动通过"`

**后端自动补充信息**

后端会自动提取并返回：

1. 图片大小 `picSize`
2. 宽高 `picWidth / picHeight`
3. 宽高比 `picScale`
4. 图片格式 `picFormat`
5. 主色 `picColor`，如果可提取

**常见失败**

| 场景 | code | message |
| --- | --- | --- |
| 未登录 | `401` | `请先登录` |
| 缺少文件字段 | `400` | `缺少文件字段 file` |
| 文件类型非法 | `400` | `仅支持 jpg、jpeg、png、webp 图片` |
| 文件过大 | `400` | `图片大小不能超过 30MB` |
| `id` 非法 | `400` | `id 必须是正整数` |
| 更新别人的图片 | `403` | `无权修改该图片` |
| 图片不存在 | `404` | `图片不存在` |
| COS 未配置 | `500` | `COS 配置不完整，请先配置本地密钥` |

**前端注意**

1. 这是 `multipart/form-data`，不是 JSON
2. 更新图片时前端要自己决定是否传 `id`
3. 如果普通用户修改图片，前端要预期该图片会重新进入待审核状态

---

### 5.9 通过 URL 上传图片

**接口**

```http
POST /api/picture/upload/url
Authorization: Bearer <token>
Content-Type: application/json
```

**作用**

根据远程图片 URL 下载后再上传到本系统。也支持通过传 `id` 更新已有图片。

**请求体**

```json
{
  "id": "101",
  "fileUrl": "https://example.com/test.jpg",
  "picName": "网络图片",
  "introduction": "来自远程地址",
  "category": "风景",
  "tags": ["远程", "测试"]
}
```

**字段说明**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | 否 | 更新已有图片时传 |
| `fileUrl` | `string` | 是 | 远程图片地址 |
| `picName` | `string` | 否 | 图片名 |
| `introduction` | `string` | 否 | 简介 |
| `category` | `string` | 否 | 分类 |
| `tags` | `string[]` | 否 | 标签数组 |

**远程 URL 限制**

| 项目 | 限制 |
| --- | --- |
| 协议 | 只支持 `http` / `https` |
| 远程文件类型 | 必须是图片 |
| 远程文件大小 | 最大 `10MB` |

**后端行为**

1. 会先尝试 `HEAD` 请求检查类型和大小
2. 再发起 `GET` 下载图片
3. 下载成功后按普通上传逻辑处理
4. 新建/更新、审核状态、权限控制与本地文件上传一致

**常见失败**

| 场景 | code | message |
| --- | --- | --- |
| 未登录 | `401` | `请先登录` |
| `fileUrl` 为空 | `400` | `fileUrl 不能为空` |
| URL 非法 | `400` | `fileUrl 必须是合法 URL` |
| 协议非法 | `400` | `fileUrl 仅支持 http 或 https` |
| 不是图片 | `400` | `远程文件不是图片` |
| 远程文件过大 | `400` | `URL 图片大小不能超过 10MB` |
| 下载失败 | `400` | `下载远程图片失败` |

---

### 5.10 删除图片

**接口**

```http
POST /api/picture/delete
Authorization: Bearer <token>
Content-Type: application/json
```

**作用**

删除图片。只有图片上传者本人或管理员可以删除。

**请求体**

```json
{
  "id": "101"
}
```

**成功返回**

```json
{
  "code": 200,
  "message": "成功"
}
```

**后端行为**

1. 逻辑删除：
   - 数据库中将 `isDelete = 1`
2. 如果图片地址属于当前 COS Host，会尝试同时删除 COS 文件
3. 如果 COS 文件不存在，不视为失败

**常见失败**

| 场景 | code | message |
| --- | --- | --- |
| 未登录 | `401` | `请先登录` |
| `id` 非法 | `400` | `id 必须是正整数` |
| 图片不存在 | `404` | `图片不存在` |
| 非上传者也非管理员 | `403` | `无权删除该图片` |

---

### 5.11 管理员审核图片

**接口**

```http
POST /api/picture/review
Authorization: Bearer <token>
Content-Type: application/json
```

**作用**

管理员审核图片，决定通过或拒绝。

**权限要求**

必须是管理员。

**请求体**

审核通过：

```json
{
  "id": "101",
  "reviewStatus": 1
}
```

审核拒绝：

```json
{
  "id": "101",
  "reviewStatus": 2,
  "reviewMessage": "图片内容不符合规范"
}
```

**字段说明**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | 是 | 图片 ID |
| `reviewStatus` | `number` | 是 | 只能是 `1` 或 `2` |
| `reviewMessage` | `string` | 否 | 当 `reviewStatus=2` 时必填 |

**成功返回**

返回审核后的完整 `PictureResponse`。

**后端行为**

1. 记录审核状态
2. 记录审核说明
3. 记录审核人 `reviewerId`
4. 记录审核时间 `reviewTime`
5. 返回值中会附带上传者 `user` 摘要

**常见失败**

| 场景 | code | message |
| --- | --- | --- |
| 未登录 | `401` | `请先登录` |
| 非管理员 | `403` | `仅管理员可访问` |
| 图片不存在 | `404` | `图片不存在` |
| `reviewStatus` 非法 | `400` | `reviewStatus 只能是 1 或 2` |
| 拒绝但未传原因 | `400` | `reviewMessage 不能为空` |

## 6. 前端调用建议

### 6.1 登录态接口统一封装

建议前端统一封装请求头：

```http
Authorization: Bearer <token>
```

### 6.2 ID 全部按字符串处理

前端状态管理、组件 props、路由参数、表单值都按字符串存储和传递。

### 6.3 图片展示优先使用 `thumbnailUrl`

原因：

1. 后端会根据 `compressPictureType` 动态返回更适合列表/预览的图片地址
2. `url` 是原图地址，直接展示在列表可能浪费带宽

推荐：

1. 列表页：优先传 `compressType=1`
2. 需要固定裁切卡片时：传 `compressType=2` 并附带裁切宽高
3. 原图预览或下载：使用 `url`

### 6.4 用户修改与管理员修改分开处理

不要混用：

1. 普通用户修改自己：`/api/user/update`
2. 管理员修改别人：`/api/admin/user/update`

### 6.5 图片编辑要注意审核状态变化

普通用户重新上传或更新图片后，会重新进入待审核状态。前端如果有作品管理页，需要把这个状态变化展示出来。

### 6.6 列表接口不要依赖 `reviewStatus` 入参

公开列表已经固定只返回审核通过图片，前端不需要尝试用这个接口查待审核或拒绝图片。

## 7. 前端常用请求示例

### 7.1 登录

```ts
await request.post("/api/user/login", {
  userEmail: "test@example.com",
  userPassword: "123456",
});
```

### 7.2 获取当前用户详情

```ts
await request.post(
  "/api/user/get/detail",
  {},
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);
```

### 7.3 获取公开图片列表

```ts
await request.post("/api/picture/list", {
  searchText: "海边",
  compressPictureType: {
    compressType: 1,
  },
  pageNum: 1,
  pageSize: 20,
});
```

### 7.4 获取图片详情

```ts
await request.post(
  "/api/picture/vo",
  {
    id: "101",
    compressPictureType: {
      compressType: 1,
    },
  },
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);
```

### 7.5 本地文件上传

```ts
const formData = new FormData();
formData.append("file", file);
formData.append("picName", "海边日落");
formData.append("category", "风景");
formData.append("tags", JSON.stringify(["日落", "海边"]));

await request.post("/api/picture/upload", formData, {
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "multipart/form-data",
  },
});
```

### 7.6 URL 上传

```ts
await request.post(
  "/api/picture/upload/url",
  {
    fileUrl: "https://example.com/test.jpg",
    picName: "网络图片",
    tags: ["远程", "测试"],
  },
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);
```

### 7.7 删除图片

```ts
await request.post(
  "/api/picture/delete",
  {
    id: "101",
  },
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);
```

### 7.8 管理员审核图片

```ts
await request.post(
  "/api/picture/review",
  {
    id: "101",
    reviewStatus: 2,
    reviewMessage: "图片内容不符合规范",
  },
  {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  }
);
```

## 8. 最后确认

如果前端对以下内容还需要单独拆分版文档，可以继续基于本文档拆：

1. 仅用户接口文档
2. 仅图片接口文档
3. 仅管理员接口文档
4. TypeScript 类型定义版
5. Swagger 风格表格版
