print("Hello, World!")

#宣告變數_1
x = 5
y = 'John'
print(x, y)

#宣告變數_2
x, y = 5, 'John'
print(x, y)

#宣告變數_3(解壓縮)
fruits = ['apple' , 'banana', 'orange']
x, y, z = fruits
print(x, y, z)

#指定變數資料類型
x = str(3)    # x 字串
y = int(3)    # y 整數
z = float(3)  # z 浮點數
print(x, y, z)

#取得變數的資料型態
print(type(x))
print(type(y))
print(type(z))

#Global Variables
#1. 在函數外部創建的變數稱為全域變數。如果函數中有相同名稱的變數，則該變數是局部的
x = "awesome" #全域變數

def myfunc():
  x = "fantastic" #局部變數
  print("Python is " + x)

myfunc()
print("Python is " + x)

#2. 如果在函數中使用 global 字樣，該變數會屬於全域作用
x = "awesome"

def myfunc():
  global x
  x = "fantastic"

myfunc()
print("Python is " + x)

