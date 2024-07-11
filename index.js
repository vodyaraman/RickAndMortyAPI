// Импорт необходимых модулей
const fs = require("fs");
const pg = require("pg");
const axios = require("axios");
const readline = require("readline");

// Конфигурация подключения к базе данных PostgreSQL
const config = {
    connectionString:
        "postgres://candidate:62I8anq3cFq5GYh2u4Lh@rc1b-r21uoagjy1t7k77h.mdb.yandexcloud.net:6432/db1",
    ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync("/home/runner/.postgresql/root.crt").toString(),
    },
};

// Создание клиента PostgreSQL с использованием конфигурации
const client = new pg.Client(config);

// Функция для получения данных с API Rick and Morty
const fetchData = async (url = "https://rickandmortyapi.com/api/character", fetchAll = false) => {
    try {
        const response = await axios.get(url);
        if (response)
            console.log("Данные получены с сайта rickandmortyapi.com");

        const results = response.data.results;
        if (fetchAll && response.data.info.next) {
            const nextResults = await fetchData(response.data.info.next, fetchAll);
            return results.concat(nextResults);
        }
        return results;
    } catch (error) {
        console.error(
            "Ошибка при запросе данных с сайта rickandmortyapi.com: ",
            error,
        );
    }
};

// Функция для создания таблицы characters в базе данных, если она не существует
const createTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS characters (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            data JSONB NOT NULL
        )
    `;
    try {
        await client.query(query);
    } catch (error) {
        console.error("Ошибка при создании таблицы: ", error);
    }
};

// Функция для удаления таблицы characters в базе данных
const dropTable = async () => {
    const query = `DROP TABLE IF EXISTS characters`;
    try {
        await client.query(query);
        console.log("Таблица characters удалена");
    } catch (error) {
        console.error("Ошибка при удалении таблицы: ", error);
    }
};

// Функция для вставки данных о персонажах в таблицу characters
const insertData = async (characters) => {
    const query = `
        INSERT INTO characters (name, data)
        VALUES ($1, $2)
        RETURNING *
    `;
    try {
        for (const char of characters) {
            const res = await client.query(query, [char.name, char]);
            if (res) console.log(`Вставлена строка с персонажем ${char.name}`);
        }
    } catch (error) {
        console.error("Ошибка вставки данных в таблицу: ", error);
    }
};

// Основная функция, выполняющая подключение к БД, создание таблицы, получение данных и вставку их в таблицу
const main = async (fetchAll) => {
    try {
        await client.connect();
        await createTable();
        const characters = await fetchData("https://rickandmortyapi.com/api/character", fetchAll);
        if (characters) {
            await insertData(characters);
        }
        await client.end();
        console.log("Операция завершена");
    } catch (error) {
        console.error("Ошибка при выполнении основной функции: ", error);
    }
};

// Функция для отображения меню выбора пользователя
const showMenu = () => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question(
        "Введите '1' для удаления таблицы, '2' для запуска основного скрипта: ",
        async (answer) => {
            if (answer === "1") {
                await client.connect();
                await dropTable();
                await client.end();
                rl.question("Желаете продолжить? (y/n): ", (cont) => {
                    if (cont.toLowerCase() === 'y') {
                        showMenu();
                    } else {
                        rl.close();
                    }
                });
            } else if (answer === "2") {
                rl.question("Введите '1' для добавления одной страницы, '2' для добавления всех страниц: ", async (fetchAnswer) => {
                    const fetchAll = fetchAnswer === "2";
                    await main(fetchAll);
                    rl.question("Желаете продолжить? (y/n): ", (cont) => {
                        if (cont.toLowerCase() === 'y') {
                            showMenu();
                        } else {
                            rl.close();
                        }
                    });
                });
            } else {
                console.log("Неверный ввод, попробуйте снова.");
                rl.close();
                showMenu();
            }
        },
    );
};

// Запуск меню выбора пользователя
showMenu();
