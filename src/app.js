//#region Imports
//express
const express = require('express');
const app = express();

//ejs
const ejs = require('ejs');
app.set('view engine', 'ejs');
//views in base directory
app.set('views', __dirname + '/views');

//serve static
app.use(express.static(__dirname + '/static'));

//body-parser
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//read config.json
const config = require('./config.json');

//mysql
let connection;
const mysql = require('mysql');
if (config.server.installed) {
    connection = mysql.createConnection({
        host: config.database.host,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database
    });

    //when connection is established
    connection.connect(function (err) {
        if (err) {
            console.error('error connecting: ' + err.stack);
            return;
        }
    });
}

//express-ejs-layouts (We could utilize react and a framework which would make this easier to manage but I wanted to keep it simple)
const expressLayouts = require('express-ejs-layouts');
app.use(expressLayouts);

//default layout
app.set('layout', './layouts/default');

//express-session
const session = require('express-session');
app.use(session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true }
}));

//qrcode
const QRCode = require('qrcode');

const fs = require('fs');

//#endregion

//#region Routes

if (!config.server.installed){
    //lead everything to install
    app.get('*', function (req, res) {
        //render install
        res.render('install', {info: config.website, title: 'Install', message: ''});
    });

    //post install
    app.post('*', function (req, res) {
        let brand = req.body.brand;
        let domain = req.body.domain;
        let host = req.body.host;
        let user = req.body.username;
        let password = req.body.password;
        let database = req.body.database;
        let port = req.body.port;

        //update config
        config.server.installed = true;
        config.website.brand = brand;
        config.website.domain = domain;
        config.database.host = host;
        config.database.user = user;
        config.database.password = password;
        config.database.database = database;

        //connect to database and check if it connects
        connection = mysql.createConnection({
            host: config.database.host,
            user: config.database.user,
            password: config.database.password,
            database: config.database.database
        });

        //when connection is established
        connection.connect(function (err) {
            if (err) {
                //redirect to install with message
                res.render('install', {info: config.website, title: 'Install', message: 'Could not connect to database. Please check your credentials and try again.'});
                return;
            }
        });

        //inject sql file
        const sql = fs.readFileSync(__dirname+'/'+'links.sql').toString();
        //run sql
        connection.query(sql, function (err, result) {
            if (err) {
                //redirect to install with message
                res.render('install', {info: config.website, title: 'Install', message: 'Could not create database. Error: ' + err});
                return;
            }
        });

        //write config with proper spacing
        fs.writeFile(__dirname + '/config.json', JSON.stringify(config, null, 4), function (err) {
            if (err) {
                //redirect to install with message
                res.render('install', {info: config.website, title: 'Install', message: 'Could not write config file. Error: ' + err});
                return;
            }
        });

        //redirect to home
        res.redirect('/');
    });

}

//home
app.get('/', function (req, res) {
    //render indexs
    res.render('index', { info: config.website, title: 'Home'});
});

//post newlink
app.post('/newlink', function (req, res) {
    //get link
    let link = req.body.link;
    let crypt;
    if(!link)return;
    //check if database has link
    connection.query('SELECT * FROM links WHERE link = ?', [link], function (error, results, fields) {
        if (error) throw error;
        //if link does not exist
        if (results.length == 0) {
            do {
                crypt = '';
                let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_|}{[]\:;?></-=';
                let charactersLength = characters.length;
                for (let i = 0; i < 6; i++) {
                    crypt += characters.charAt(Math.floor(Math.random() * charactersLength));
                }
                connection.query('SELECT * FROM links WHERE shortlink = ?', [crypt], function (error, results, fields) {
                    if (error) throw error;
                });
            } while (results.length != 0);
            //insert link and crypt into database
            connection.query('INSERT INTO links (link, shortlink) VALUES (?, ?)', [link, crypt], function (error, results, fields) {
                if (error) throw error;
            });
        }else{
            //get link's shortlink
            crypt = results[0].shortlink;
        }
        shortlink = (`${config.website.domain}/${crypt}`);
        //qr code
        QRCode.toDataURL(shortlink, function (err, qr) {
            //render newlink
            
            res.json({ link: link, shortlink: shortlink, qr: qr });
        });
    });
});
//#endregion

//privacypolicy
app.get('/privacypolicy', function (req, res) {
    //render privacypolicy
    res.render('privacypolicy', { info: config.website, title: 'Privacy Policy' });
});

//faq
app.get('/faq', function (req, res) {
    //render faq
    res.render('faq', { info: config.website, title: 'FAQ' });
});

//link
app.get('/:link', function (req, res) {
    //get link
    let link = req.params.link;
    //check if database has link
    connection.query('SELECT * FROM links WHERE shortlink = ?', [link], function (error, results, fields) {
        if (error) throw error;
        //if link does not exist
        if (results.length == 0) {
            //send 404
            res.status(404).send('404 Not Found');
        } else {
            //render redirect
            res.render("redirect", { info: config.website, title: 'Redirecting', url: results[0].link });
        }
    });
});

//listen
app.listen(config.server.port, function () {
    console.log('Listening on port ' + config.server.port);
});
