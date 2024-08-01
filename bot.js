import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes, CallbackQueryHandler, Updater

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# 存储订阅、管理员和超级管理员的信息
subscriptions = {}
admins = set()
superadmin = 'your_superadmin_id'  # 超级管理员的Telegram ID
selected_subscriptions = set()
PAGE_SIZE = 5

# 添加订阅
async def add_subscription(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if str(update.effective_user.id) not in admins and str(update.effective_user.id) != superadmin:
        await update.message.reply_text("你没有权限使用此命令。")
        return
    try:
        remark, url = context.args[0], context.args[1]
        subscriptions[remark] = url
        await update.message.reply_text(f"已添加订阅：{remark} -> {url}")
    except IndexError:
        await update.message.reply_text("使用方法：/ad <备注> <URL>")

# 删除订阅
async def delete_subscription(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if str(update.effective_user.id) not in admins and str(update.effective_user.id) != superadmin:
        await update.message.reply_text("你没有权限使用此命令。")
        return
    try:
        keyword = context.args[0]
        deleted = False
        for remark, url in list(subscriptions.items()):
            if keyword in remark or keyword in url:
                del subscriptions[remark]
                await update.message.reply_text(f"已删除订阅：{remark} -> {url}")
                deleted = True
        if not deleted:
            await update.message.reply_text("未找到相关订阅。")
    except IndexError:
        await update.message.reply_text("使用方法：/del <关键字>")

# 列出所有订阅
async def list_subscriptions(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if str(update.effective_user.id) not in admins and str(update.effective_user.id) != superadmin:
        await update.message.reply_text("你没有权限使用此命令。")
        return
    if subscriptions:
        reply_text = "\n".join([f"{remark} -> {url}" for remark, url in subscriptions.items()])
    else:
        reply_text = "没有订阅。"
    await update.message.reply_text(reply_text)

# 添加管理员
async def add_admin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if str(update.effective_user.id) != superadmin:
        await update.message.reply_text("你没有权限使用此命令。")
        return
    try:
        tg_id = context.args[0]
        admins.add(tg_id)
        await update.message.reply_text(f"已添加管理员：{tg_id}")
    except IndexError:
        await update.message.reply_text("使用方法：/admin <Telegram ID>")

# 生成翻页按钮
def generate_pagination_buttons(page: int):
    items = list(subscriptions.items())
    start_index = page * PAGE_SIZE
    end_index = start_index + PAGE_SIZE
    keyboard = []

    for i in range(start_index, min(end_index, len(items))):
        remark, url = items[i]
        prefix = "√ " if remark in selected_subscriptions else ""
        keyboard.append([InlineKeyboardButton(f"{prefix}{remark} -> {url}", callback_data=remark)])

    if page > 0:
        keyboard.append([InlineKeyboardButton("上一页", callback_data=f"prev_{page - 1}")])
    if end_index < len(items):
        keyboard.append([InlineKeyboardButton("下一页", callback_data=f"next_{page + 1}")])

    keyboard.append([InlineKeyboardButton("我已经选择好了，整合订阅", callback_data="combine")])

    return InlineKeyboardMarkup(keyboard)

# 订阅整合
async def convert_subscriptions(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if str(update.effective_user.id) not in admins and str(update.effective_user.id) != superadmin:
        await update.message.reply_text("你没有权限使用此命令。")
        return
    await update.message.reply_text("选择要整合的订阅：", reply_markup=generate_pagination_buttons(0))

async def button(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data

    if data.startswith("prev_") or data.startswith("next_"):
        page = int(data.split("_")[1])
        await query.edit_message_reply_markup(reply_markup=generate_pagination_buttons(page))
    elif data == "combine":
        combined_urls = [subscriptions[remark] for remark in selected_subscriptions]
        combined_result = "\n".join(combined_urls)  # 整合逻辑简单示例
        await query.edit_message_text(text=f"已整合订阅：\n{combined_result}")
    else:
        if data in selected_subscriptions:
            selected_subscriptions.remove(data)
        else:
            selected_subscriptions.add(data)
        current_page = (list(subscriptions.keys()).index(data)) // PAGE_SIZE
        await query.edit_message_reply_markup(reply_markup=generate_pagination_buttons(current_page))

# 启动机器人时发送消息给超级管理员
async def start_bot(app):
    async with app:
        await app.bot.send_message(chat_id=superadmin, text="我已经启动了")

# 主函数
if __name__ == '__main__':
    # 直接在代码中包含 Telegram 机器人令牌
    token = "YOUR_BOT_TOKEN"
    app = ApplicationBuilder().token(token).build()

    app.add_handler(CommandHandler("ad", add_subscription))
    app.add_handler(CommandHandler("del", delete_subscription))
    app.add_handler(CommandHandler("list", list_subscriptions))
    app.add_handler(CommandHandler("admin", add_admin))
    app.add_handler(CommandHandler("convert", convert_subscriptions))
    app.add_handler(CallbackQueryHandler(button))

    # 启动时发送消息给超级管理员
    import asyncio
    asyncio.run(start_bot(app))

    app.run_polling()
