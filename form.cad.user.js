// ==UserScript==
// @name         { form.cad }
// @namespace    https://github.com/ecXbe/form.cad
// @version      0.1.7
// @description  Simplifies work with cadastral base
// @author       ezX {cps};
// @match        *://cadastru.md/ecadastru/*
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// @icon         https://github.com/ecXbe/form.cad/blob/main/assets/logo.png?raw=true
// @require      http://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    const $ = jQuery.noConflict(true);

    class DataBase {
        get() {
            return GM_getValue('ACD');
        }

        set(query) {
            if (typeof(query) === 'object') {
                return GM_setValue('ACD', query);
            } else {
                let [key, value] = query.split(':').map(part => part.trim());

                let info = GM_getValue('ACD');
                info[key] = value;
                GM_setValue('ACD', info);
            }
        }

    }

    const db = new DataBase();

    GM_xmlhttpRequest({
        method: "GET",
        url: 'https://raw.githubusercontent.com/ecXbe/form.cad/main/config.json',
        onload: function(response) {

            let $current_version = GM_info.script.version;
            console.log($current_version);
            let $last_version = JSON.parse(response.responseText).version;

            let $v1 = $current_version.split(/[./]/).map(Number).filter(s => !isNaN(s));
            let $v2 = $last_version.split(/[./]/).map(Number).filter(s => !isNaN(s));

            if (JSON.stringify($v1) === JSON.stringify($v2)) return

            let $n1,$n2;
            for (let i = 0; i < Math.max($v1.length, $v2.length); i++) {
                $n1 = $v1[i] || 0;
                $n2 = $v2[i] || 0;

                if ($n1 > $n2) {return} else if ($n1 < $n2) {break}
            }

            alert('Доступно новое обновление { form.cad } v'+$last_version);
            window.location.href = 'https://github.com/ecXbe/form.cad/raw/main/form.cad.user.js';
            alert('Вы обновились. Перезагрузите страницу для применения изменений');
            window.location.reload();
        }
    });


    let $title = $('i').eq(0);

    setInterval(function() {

        let stats = db.get();
        if (typeof(stats) !== 'undefined') {
            if (stats.status === 'online') {
                if (!$title.text().includes('Registrul bunurilor imobile')) {
                    if (stats.action === 'parse' || stats.action === 'completed') {
                        console.log(stats.point);
                        if (stats.point > stats.finish_point) {

                            let copyInterval = setInterval(function() {
                                try {
                                    navigator.clipboard.writeText(stats.result).then(function() {
                                        db.set({status: 'offline'});
                                        clearInterval(copyInterval);
                                        alert('Well Done');
                                    })
                                } catch {}
                            }, 1000)

                            return db.set('status: offline');
                        }

                        if (unsafeWindow.server_is_free(18) !== 0) {
                            unsafeWindow.getObject(`${stats.point} `);
                            let check_out = setInterval(function() {
                                console.log('looped');
                                if ($("a.docBtn.l-btn.l-btn-small").length) {
                                    $("a.docBtn.l-btn.l-btn-small").click();
                                    $("#infoResult").empty();
                                    clearInterval(check_out);
                                } else {
                                    let $warning_push = $('div.panel.window.messager-window').find('div').filter(function() {return $(this).text().trim() === 'Pentru obiectul selectat nu este informație grafică!';});
                                    console.log($warning_push);
                                    if ($warning_push.length > 0) {
                                        $('div.panel.window.messager-window').find('a.l-btn.l-btn-small')[0].click();
                                        db.set('action: parse');
                                        clearInterval(check_out);
                                    }
                                }
                            }, 500);
                        }

                        db.set(`point: ${parseInt(stats.point)+1}`);
                        db.set('action: parsed');
                    }
                }
            }
        }
    }, 1500)

    function parse_info() {
        const $_ = '	';

        let $info = '';

        $('head').append($('<script>', {src: 'https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js'}))

        // Площадь
        let $area = $('td').filter(function() {
            return $(this).text().trim() === 'Suprafata' || $(this).text().trim() === 'Suprafaţa';
        }).eq(0).parent().children().last().text().replace('ha', '').trim().replace('.', ',');

        // Владельцы
        let $persons_td = $('td').filter(function() {
            return $(this).text().trim() === 'Proprietarul';
        });
        let $persons = $persons_td.map(function() {
            return $(this).parent().children().last().text().trim()
        }).get();

        // Получение информации о владельце
        function getperson_info($person_info) {
            let $name = $person_info.match(/^[^\d,\()]+/);

            if ($name) {
                $name = $name[0].trim();
            } else {
                $name = '-';
            }

            let $age = $person_info.match(/\((.*?)\)/);

            if ($age) {
                $age = $age[1];
            } else {
                $age = '-';
            }

            let $cod = $person_info.match(/Codul Personal (\d+)/);

            if ($cod) {
                $cod = $cod[1];
            } else {
                $cod = '-';
            }
            return {
                name: $name,
                age: $age,
                cod: $cod
            }
        }

        // Контракты + Договора
        let $contracts = $('td').filter(function() {
            return $(this).text().trim() === 'Temeiul inscrierii' || $(this).text().trim() === 'Temeiul înscrierii';
        })

        let $result = ''

        console.log(`Владельцев: ${$persons.length}`);
        console.log(`Контрактов: ${$persons.length}`);
        console.log(`Договоров: ${$contracts.length - $persons.length}`);
        console.log('|---------------------|');

        for (let $i = 0; $i < $persons.length; $i++) {
            window.$i = $i;

            console.log(`Информация о ${$i+1} владельце:`);

            let $table = $persons_td.eq($i).closest('table');

            let $person_info = $persons[$i];

            // Кадастровый номер
            let $cadastru = $table.find('td').filter(function() {
                return $(this).text().trim() === 'Bunul imobil';
            }).parent().children().last().text();

            let $part = '';
            if ($persons.length > 1) {
                $part = $table.find('td').filter(function() {
                    return $(this).text().trim() === 'Cota parte';
                }).parent().children().last().find('b').text().trim();
            }

            // Инициализация информации о владельце
            let $person_parse = getperson_info($person_info);

            // Получение контрактов (|)
            let $contract = $table.find('td').filter(function() {
                return $(this).text().trim() === 'Temeiul inscrierii' || $(this).text().trim() === 'Temeiul înscrierii';
            }).parent().children().last().find('b').html().split('<br>').map(
                s => s.replace(/\([^)]*\)/g, '').trim()
            ).filter(function(e) {
                return e.trim() !== '';
            }).map(function(element) {
                if (element.includes($cadastru.replace('.', ''))) { // Удаление кадастрового номера из названия контракта
                    return element.split('nr.')[0].trim();
                }
                return element;
            });

            // Отладка

            console.log('Кадастровый номер: ' + $cadastru);
            console.log('Площадь: ' + $area);
            console.log('Полная информация о человеке: ' + $person_info);
            console.log('Имя: ' + $person_parse.name);
            console.log('Год рождения: ' + $person_parse.age);
            console.log('Персональный код: ' + $person_parse.cod);
            console.log('Контракты: ' + $contract);

            if ($persons.length > 1 && $i !== 0) {
                $area = '';
            }
            // Отформатированная информация о Владельце
            $info = $person_parse.name + $_ + $person_parse.age + $_ + $person_parse.cod + $_ + $part + $_ + $cadastru + $_ + $area + $_ + $contract[0];

            if (($contracts.length - $persons.length) <= $i) {
                $result += $info + '\r\n';
                continue;
            }

            // Наличие договоров
            if ($contracts.length - $persons.length > 0) {
                // Договор/ы
                let $agreements = [];
                for (let $j = 0; ($contracts.length - $persons.length)-($persons.length * $j) >= $i + 1; $j++) {
                    console.log($j, parseInt(($contracts.length-1)/$persons.length))
                    let $agreement_table = $table.nextAll('table').eq(($persons.length-1)+($persons.length*$j));
                    let $agreement = $agreement_table.find('td').filter(function() {
                        return $(this).text().trim() === 'Temeiul inscrierii' || $(this).text().trim() === 'Temeiul înscrierii';
                    }).parent().children().last().find('b').html().replace('\n', '').split('<br>').map(
                        s => s.replace(/\([^)]*\)/g, '').trim()
                    ).filter(function(e) {
                        return e.trim() !== '';
                    });

                    let $date = $agreement_table.find('td').filter(function() {
                        return $(this).text().trim() === 'Termenul / Conditia' || $(this).text().trim() === 'Termenul / Condiţia';
                    }).parent().children().last().text().trim();

                    let $company = $agreement_table.find('td').filter(function() {
                        return $(this).text().trim() === 'Titularul grevarii / Solicitantul' || $(this).text().trim() === 'Titularul grevării / Solicitantul';
                    }).parent().children().last().text().trim();

                    $agreements.push($agreement[0] + $_ + $date + $_ + $company);
                    $agreements.push(...$agreement.slice(0, 1));
                }
                $agreements = $agreements.flat();
                console.log(typeof($agreements));
                console.log('Договора: ' + $agreements);
                console.log($agreements.length);

                // Отформатированная информация о договорах / Продолжение предыдущего
                $info = $info + $_ + $agreements[0];

                // Проверка на наличие нескольких договоров / Наличие нескольких строк в Excel
                if ($contract.length > 1 || $agreements.length > 1) {
                    console.log('Форматировка договоров');
                    // c_a - Отфармотированные Контракты + Договора
                    let $c_a = '';
                    // Вставка контрактов и договоров на их места в зависимости от строки
                    console.log($contract);
                    console.log($agreements);
                    console.log($contract.length, $agreements.length);
                    for (let i = 1; i < Math.max($contract.length, $agreements.length); i++) {
                        console.log(i);
                        let $c = $contract[i] !== undefined ? $contract[i] : '';
                        let $a = $agreements[i] !== undefined ? $agreements[i] : '';
                        i === 1 ? $c_a = $c_a + $c + $_ + $a : $c_a = $c_a + '\r\n' + $_.repeat(6) + $c + $_ + $a;
                    }
                    $info = $info + '\r\n' + $_.repeat(6) + $c_a;
                }
            }
            $result += $info + '\r\n';
            console.log('|---------------------|');
        }

        let $stats = db.get();
        if ($stats.status === 'online') {
            db.set(`result: ${$stats.result + '\r\n' + $result}`);
            db.set('action: completed');
            return window.close();
        }

        // Кнопка
        $('head').append($('<style>', {type: 'text/css', text: `.copy_btn {margin-left: 5px; background: #cdcdcd; padding: 2px; border: black solid 1px; border-radius: 3px; cursor: pointer;} .copy_btn:hover {color: unset; background: #b1b1b1}`}))
        $title.parent().append($('<a>', {class: 'copy_btn', text: 'Скопировать'}).click(function() {
            let $btn = $(this);
            let $temp = $('<textarea>');
            $('body').append($temp);
            $temp.val($result).select();
            document.execCommand('copy');
            $temp.remove();

            //alert('Информация была скопирована!');
            $btn.text('Скопировано!!!');
            setTimeout(function() {
                $btn.text('Скопировать');
            }, 1500);

        }));
    }

    if ($title.text().includes('Registrul bunurilor imobile')) {
        parse_info();

    } else {
        db.set({status: 'offline'});
        window.addEventListener('load', function() {

            $('head').append($('<style>', {type: 'text/css', text: `.start, .stop, .filters {margin: 10px 0 0 10px; border-radius: 6px; width: 100px; border:2px solid #000;} .acd_btn {margin-left:10px; background:#cdcdcd; padding:3px; border-radius:6px; border:2px solid #000; color:#000; cursor:pointer;} .acd_btn:hover {background: #b1b1b1;}`}))

            $('.easyui-accordion.accordion.easyui-fluid').filter(function() {
                return $(this).find('div.panel-title').eq(0).text().trim() === 'Căutare universală' || $(this).find('div.panel-title').eq(0).text().trim() === 'Cautare universala';
            }).eq(0).append(
                $('<div>', {style: 'width: 100%'}).append(
                    $('<input>', {class: 'start', placeholder: 'Start'})
                ).append(
                    $('<input>', {class: 'stop', placeholder: 'Stop'})
                ).append(
                    $('<input>', {class: 'filters', placeholder: 'Filters'})
                ).append($('<a>', {class: 'acd_btn', text: 'AutoCAD'}).click(function() {

                    let $start = $('.start').val();
                    let $stop = $('.stop').val();
                    let $filters = $('.filters').val();

                    if (!$('a#nLogout').length) {
                        return alert('Вы должны быть авторизованы');
                    } else if (!$start || !$stop) {
                        return alert('Поля Start и Stop не могут быть пустыми');
                    } else if ($start.length !== 10 || $stop.length !== 10) {
                        return alert('Введены значения неверного формата');
                    } else if ($start.substring(0, 7) !== $stop.substring(0, 7)) {
                        return alert('Поля не могут быть разных массивов');
                    } else if ($start > $stop) {
                        return alert('Поле Start не может быть больше Stop');
                    }

                    db.set({status: 'online', action: 'parse', start_point: $start, point: $start, finish_point: $stop, result: ''});

                }))).append($('<a>', {class: 'init_acd'}))
            $('input.start, input.stop').on('input', function() {
                $(this).val($(this).val().replace(/[^0-9]/g, ''));
            })
        })
    }
})();