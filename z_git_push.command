# 获取脚本所在目录的绝对路径
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# 进入脚本所在目录
cd "$SCRIPT_DIR" || exit

# 执行Git命令
echo "正在添加所有更改到暂存区..."
git add .

echo "正在提交更改..."
git commit -m "auto_update"

echo "正在推送到远程仓库..."
git push origin master



echo "操作完成！"    