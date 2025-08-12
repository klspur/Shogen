""""""""""""""""""
# Data Types
""""""""""""""""""
# Text 文字:	str
# Numeric 數字:	int, float, complex
# Sequence 順序:	list, tuple, range
# Mapping 映射:	dict
# Set Types:	套裝, frozenset
# Boolean 布林:	bool
# Binary 二進位:	bytes, bytearray, memoryview
# None 無類型:	NoneType

# str: x = "Hello World"
# int: x = 20
# float: x = 20.5
# complex: x = 5j (虛數只能用j寫)
# list: x = ["a", "b", "c"]
# tuple: x = ("a", "b", "c")
# dict: x = {"name": "John", "age": 36}
# bool: x = TRUE

# 取得變數類型
x = 5j
print(type(x))

x = 5.5
x = int(x)
print(x)

# 隨機數
import random
print(random.randrange(1, 10))

