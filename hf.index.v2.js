const request = require('request')
const fs = require('fs')
const cheerio = require('cheerio')
const redis = require("redis")
const exec = require('child_process').exec

let redis_key = "wdj_high_collect_list"
let sync_key  = "code detect"
let upload_url = "http://gy2.bshu.com/high_apk/update"

function gethtml(url, cookie) {
    var promise = new Promise((r, j) => {
        request.get({
            url: url, timeout: 10000, headers: {
                cookie: cookie
            }
        }, (e, resp) => {
            if (e) {
                j()
            } else {
                try {
                    r(resp.body)
                } catch (e) {
                    j()
                }
            }
        })
    })
    return promise
}

function post(url, json) {
    var promise = new Promise((r, j) => {
        request.post({ url: url, json: json, timeout: 10000, encoding: "utf-8" }, (e, resp) => {
            if (e) {
                j(e)
            } else {
                try {
                    r(resp.body)
                } catch (e) {
                    j(e)
                }
            }
        })
    })

    return promise
}

function exec_cmd(sh) {
    var promise = new Promise((r, j) => {
        exec(`${sh}`, function (error, stdout, stderr) {
            if (!error) {
                r(stdout)
            } else {
                j(stderr)
            }
        })
    })
    return promise
}


async function rasdialDisConnect() {
    let msg = await exec_cmd("rasdial  /DISCONNECT").catch(console.log)
    console.log(msg)
}

async function rasdialConnect() {
    let msg = await exec_cmd("rasdial 宽带连接 008 123456").catch(console.log)
    console.log(msg)
}

async function api_android_update(data) {
    return await post(upload_url, data).catch(console.error)
}

function lpop() {
    let promise = new Promise((resolve, reject) => {
        console.log(redis_key)
        client.zrange(redis_key, 0, 0, function (err, value) {
            if (value && value.length) {
                if (client.zrem(redis_key, value)) {
                    resolve(value[0])
                } else {
                    resolve()
                }
            }
            if (err) {
                reject(err)
            } else {
                resolve()
            }
        })
    })
    return promise
}

async function get_android_app_info_loop(package) {
    console.log(`package is ${package}`)
    let funs = [get_wdj_app_info]
    let data = undefined
    for (let i = 0; i < funs.length; i++) {
        data = await funs[i](package).catch(console.error)
        console.log(data)
        if (data && data.app_name) {
            data.status = 1

            if (data.app_desp) {
                data.app_desp = filter_desp(data.app_desp)
            }

            if (data.version_desp) {
                data.version_desp = filter_desp(data.version_desp)
            }

            console.dir(data)
            let result = await api_android_update(data).catch(console.error)
            console.log(result)
            if (result && result.code == 1) {
                console.log(`update ${data.package} success`)
            } else {
                console.log(`update ${data.package} fail`)
            }
        }
    }
}

function is_detect_code($, html){
    if ($(".app-icon").length == 0 && $(".app-name").length == 0) {    
        console.log("code detect: "+html.indexOf("霸下通用"))  
        if (html.indexOf("霸下通用") != -1) {
            client.get(sync_key, async (val)=>{
                if(val == 1){
                    client.set(sync_key, 0)
                    await exec_cmd("python wdj_code_pass.py")
                    client.set(sync_key, 1);
                }
            })
            return true        
        }
        return true
    }
    return false
}

async function get_wdj_app_info(package) {
    let url = `https://www.wandoujia.com/apps/${package}`
    console.log(url)
    let cookie = fs.readFileSync("cookies.txt")
    let html = await gethtml(url, cookie.toString()).catch(console.error)
    let data = {}
    if (!html) {
        return
    }
    const $ = cheerio.load(html)

    data.package = package
    if ($) {   
        if (is_detect_code($, html)) {     
            client.zadd(redis_key, 0, package)  
            return data
        }
        data.app_url = url
        data.app_name = $("span.title").eq(0).text()
        let info_list_dts = $(".infos-list").eq(0).find("dt")

        data.score = $(".love i").eq(0).text() || ""
        data.comment_num = $(".comment-open").eq(0).text() || 0
        data.down_num = $(".install i").eq(0).text() || 0
        data.developer = $(".dev-sites").eq(0).text() || ""

        for (let i = 0; i < info_list_dts.length; i++) {
            let dtObj = info_list_dts.eq(i)
            if (dtObj.text() == "版本") {
                data.version_name = dtObj.next().text().trim()
            }
        }

        if (data.version_name)
            data.version_name = data.version_name.replace("v", "").replace("V", "")

        data.icon_path = $(".app-icon img").eq(0).attr("src")
        data.app_upd_time = new Date($(".update-time").eq(0).attr("datetime")).getTime() / 1000 || ""

        let desp = $(".desc-info div").eq(0).html()
        if (desp) {
            desp = desp.split("更新内容")
            data.app_desp = desp[0]
            if (desp.length > 1)
                data.version_desp = desp[1]
        }

        data.app_down_url = $("a.normal-dl-btn").eq(0).attr("href") || ""
        data.file_size = parseInt(parseFloat($("meta[itemprop=fileSize]").eq(0).attr('content')) * 1024 * 1024) || 0

        if (data.app_name) {
            data.status = 1
        } else {
            data.status = 404
        }

        return data
    }
}

async function android_task(package) {
    await get_android_app_info_loop(package).catch(console.error)
}

function filter_desp(desp) {
    return desp.replace(/\d{5,}/g, '').replace(/QQ/g, '').replace(/QQ群/g, '').replace(/手机号/g, '')
}

async function android() {
    setTimeout(async () => {
        let package = await lpop(redis_key).catch(console.error)
        if (!package) {
            await android()
            return
        }
        console.log(`loop ${redis_key}`)
        await android_task(package)
        await android()
    }, 1000)
}


(async () => {
    client = redis.createClient({
        port: 6389,
        password: "xxxxxxxxxxxxxx",
        host: "xx.xx.xx.xx",
    })

    client.on('ready', async function () {
        client.set(sync_key, 1)
        await android()
    })

    client.on("error", async function (err) {
        console.error("Redis error:" + err)
    })
})()


