import time
import random
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from pynput.mouse import Button, Controller as c1


options = webdriver.ChromeOptions()
ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.103 Safari/537.36'
options.add_argument('user-agent=' + ua)
options.add_argument('--ignore-certificate-errors')
options.add_argument('--ignore-ssl-errors')
options.add_experimental_option("excludeSwitches", ["enable-logging"])
driver = webdriver.Chrome(options=options)
driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
  "source": """
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    })
  """
})
driver.maximize_window()

url = 'https://www.wandoujia.com/apps/7751273'
driver.get(url)
mouse = c1()
# 验证码托动的开始坐标 、托动长度
code_x = 1050
code_y = 488
code_offset = 300

while True:
    time.sleep(3)
    # 模拟鼠标轨迹
    mouse.position = (random.randint(1,1080), random.randint(1,1080))
    for i in range(random.randint(1,500)):
      mouse.move(random.randint(1+i,1080), random.randint(1+i,1080))
    # 模拟拖动验证码
    time.sleep(random.random())
    mouse.position = (code_x + random.randint(1,15), code_y + random.randint(1,10))
    time.sleep(random.random())
    mouse.press(Button.left)
    time.sleep(random.random())
    mouse.move(code_x + code_offset + random.randint(1,15), code_y + random.randint(1,10))
    time.sleep(random.random())
    mouse.release(Button.left)
    # 检测是否已经通过验证码
    try:
        el = driver.find_element(By.CLASS_NAME , "app-info")
        # 通过获取cookies保存起来
        cookie= driver.get_cookies()
        cookies = ""
        for c in cookie:
            cookies += c['name']+'='+c ['value']+";"
        print(cookies)
        fo = open("cookies.txt", "w")
        fo.write(cookies)
        fo.close()
        break
    except Exception as e:
        driver.refresh()  
        continue
driver.quit()







