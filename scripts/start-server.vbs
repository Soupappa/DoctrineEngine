Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Users\ANTOINE\projects\Doctrine Engine"
shell.Run """C:\Program Files\nodejs\node.exe"" ""C:\Users\ANTOINE\projects\Doctrine Engine\scripts\static-server.cjs""", 0, False
