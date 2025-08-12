# Strings are arrays
# 1. Python 中的字串是 Unicode 字元陣列 
# 2. 單個字元只是一個長度為 1 的字串，方括弧可查詢字串元素的位置。（第一個字元位置為0）
a = "Hello, World!"
print(a[1])

# 大寫：upper
# 小寫：lower
a = "Hello World"
print(a.upper())
print(a.lower())

# 替換字元：replace
a = "Hello, World!"
print(a.replace("H", "J"))

# 刪除前後空格：strip
a = " Hello World "
print(a.strip())

# 拆分字串：split
a = "Hello, World!"
print(a.split(","))