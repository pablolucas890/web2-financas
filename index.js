const express = require('express');
const expressHandlebars = require('express-handlebars');
const path = require('path');
var url = require('url');
const sessions = require("express-session");
const cookieParser = require("cookie-parser");
const uuidv4 = require('uuid').v4;
const mysql = require('mysql2/promise');

const PORT = process.env.PORT || 3001;

const app = express();

app.engine('handlebars', expressHandlebars.engine());

app.set('view engine', 'handlebars');

app.set('views', './views');

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(sessions({
    secret: "thisIsMySecretKey",
    saveUninitialized: true,
    resave: false,
    name: 'Cookie de Sessao',
    cookie: { maxAge: 1000 * 60 * 3 } // 3 minutos
}));
async function getConnection() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'new_user',
        password: 'password',
        database: 'santos_financeiro'
    });
    return connection;
}

async function query(sql = '', values = []) {
    const conn = await getConnection();
    const result = await conn.query(sql, values);
    conn.end();

    return result[0];
}

app.use("*", async function (req, res, next) {
    if (!req.session.usuario && req.cookies.token) {
        const resultado = await query("SELECT * FROM usuarios WHERE token = ?", [req.cookies.token]);
        if (resultado.length) {
            req.session.usuario = resultado[0];
        }
    }
    next();
});

app.get("/login", function (req, res) {
    res.render("login", {
        login: true,
        tituloPagina: "Login",
        titulo: "Login",
        frase: "Utilize o formulário abaixo para realizar o login na aplicação."
    });
});

app.post("/login", async function (req, res) {
    const { user: usuario, pwd, keep_logged } = req.body;
    const resultado = await query("SELECT * FROM usuarios WHERE email = ? AND senha = ?", [usuario, pwd]);
    // console.log(resultado);

    if (resultado.length > 0) {
        if (keep_logged) {
            const token = uuidv4();
            console.log("----", token);
            const isOk = await query("UPDATE usuarios SET token = ? WHERE usuario_id = ?", [token, resultado[0].usuario_id]);
            console.log(isOk);
            res.cookie("token", token);
        }

        req.session.usuario = resultado[0];
        res.redirect("/");
        return;
    } else {
        console.log("--666--");
    }

    res.render("login", {
        login: true,
        tituloPagina: "Login",
        titulo: "Login",
        frase: "Utilize o formulário abaixo para realizar o login na aplicação.",
        mensagemErro: "Usuário/Senha inválidos!"
    });
});

app.get("/", async function (request, response) {
    if (!request.session.usuario) {
        response.redirect("/login");
        return;
    }
    const financas = await query('SELECT * FROM financas');
    const categorias = await query('SELECT * FROM categoria');
    let totalEntradas = 0;
    let totalSaidas = 0;
    financas.map((fin) => {
        if (fin.tipo == 1) {
            totalEntradas += fin.valor;
        } else {
            totalSaidas += fin.valor;
        }
    })
    const total = totalEntradas - totalSaidas;
    financas.map((financa) => {
        categorias.map((categoria) => {
            if (financa.id_categoria === categoria.id_categoria) {
                financa.categoria = categoria.nome_categoria;
            }
        })
    })
    response.render('home', {
        tituloPagina: 'Finanças',
        listafinancas: financas,
        totalEntradas,
        totalSaidas,
        total,
    })
});

app.get("/excluir-produto/:id", async function (request, response) {
    if (!request.session.usuario) {
        response.redirect("/login");
        return;
    }
    const id = parseInt(request.params.id);
    if (!isNaN(id) && id > 0) {
        await query('DELETE FROM financas WHERE id_financa = ?', [id]);
    }
    response.redirect('/');
});

app.get('/editar-produto/:id', async function (request, response) {
    if (!request.session.usuario) {
        response.redirect("/login");
        return;
    }
    const id = parseInt(request.params.id);
    const dadosProduto = await query("SELECT * FROM financas WHERE id_financa = ?", [id]);
    if (dadosProduto.length === 0) {
        response.redirect("/");
        return;
    }
    const financa = dadosProduto[0];
    const categorias = await query('SELECT * FROM categoria');
    categorias.map((categoria) => {
        if (categoria.id_categoria === financa.id_categoria) {
            categoria.checked = true
        }
    })
    response.render('editar-produto', {
        tituloPagina: 'Editar Finança',
        financa,
        categorias
    });
});

app.post('/editar-produto', async (request, response) => {

    let id = request.body.id
    let titulo = request.body.titulo;
    let valor = request.body.valor;
    let tipo = request.body.tipo;
    let categoria = request.body.categoria;
    let dataDate = new Date();
    let dia = dataDate.getDay().toString();
    let mes = dataDate.getMonth().toString();
    let year = dataDate.getFullYear().toString();
    let hora = dataDate.getHours().toString();
    let minute = dataDate.getMinutes().toString();

    if (dia.length == 1)
        dia = '0' + dia;
    if (mes.length == 1)
        mes = '0' + mes;
    if (hora.length == 1)
        hora = '0' + hora;
    if (minute.length == 1)
        minute = '0' + minute;

    let data = dia + "/" + mes + "/" + year;
    let totalhora = hora + ":" + minute;

    dadosPagina = {
        tituloPagina: 'Editar Finança',
        titulo,
        valor,
        categoria,
        tipo,
        hora,
        totalhora
    }

    try {
        if (!titulo)
            throw new Error('Nome é obrigatório!');

        if (categoria === '0')
            throw new Error('Categoria é obrigatório!');

        if (valor <= 0)
            throw new Error('Preco inválido!');

        let sql = "UPDATE financas SET titulo = ?, valor = ?, tipo = ?, id_categoria = ?, data = ?, hora = ? WHERE id_financa = ?";
        let valores = [titulo, valor, tipo === "entrada" ? 1 : 0, categoria, data, totalhora, id];
        await query(sql, valores);
        dadosPagina.mensagem = 'Produto Editado com sucesso!';
        dadosPagina.cor = "green";
    }
    catch (error) {
        dadosPagina.mensagem = error.message;
        dadosPagina.cor = "red";
    }
    response.render('editar-produto', dadosPagina);
});

app.get('/cadastrar-produto', async function (request, response) {
    if (!request.session.usuario) {
        response.redirect("/login");
        return;
    }
    const categorias = await query('SELECT * FROM categoria');
    response.render('cadastrar-produto', { tituloPagina: 'Cadastrar Finança', categorias });
});

app.post('/cadastrar-produto', async (request, response) => {

    let titulo = request.body.titulo;
    let valor = request.body.valor;
    let tipo = request.body.tipo;
    let categoria = request.body.categoria;
    let dataDate = new Date();
    let dia = dataDate.getDay().toString();
    let mes = dataDate.getMonth().toString();
    let year = dataDate.getFullYear().toString();
    let hora = dataDate.getHours().toString();
    let minute = dataDate.getMinutes().toString();

    if (dia.length == 1)
        dia = '0' + dia;
    if (mes.length == 1)
        mes = '0' + mes;
    if (hora.length == 1)
        hora = '0' + hora;
    if (minute.length == 1)
        minute = '0' + minute;

    let data = dia + "/" + mes + "/" + year;
    let totalhora = hora + ":" + minute;

    dadosPagina = {
        tituloPagina: 'Cadastrar Finança',
        titulo,
        valor,
        categoria,
        tipo,
        hora,
        totalhora
    }
    try {
        if (!titulo)
            throw new Error('Nome é obrigatório!');

        if (categoria === '0')
            throw new Error('Categoria é obrigatório!');

        if (valor <= 0)
            throw new Error('Preco inválido!');

        let sql = "INSERT INTO financas(titulo, valor, tipo, id_categoria, data, hora) VALUES(?, ?, ?, ?, ?, ?)";
        let valores = [titulo, valor, tipo === "entrada" ? 1 : 0, categoria, data, totalhora];
        await query(sql, valores);
        dadosPagina.mensagem = 'Produto Cadastrado com sucesso!';
        dadosPagina.cor = "green";
    }
    catch (error) {
        dadosPagina.mensagem = error.message;
        dadosPagina.cor = "red";
    }
    response.render('cadastrar-produto', dadosPagina);
});

app.get("/logout", function(req, res) {
    res.cookie("token", "");
    req.session.destroy();
    res.redirect("/login");
});

app.get('/sobre', function (request, response) {
    if (!request.session.usuario) {
        response.redirect("/login");
        return;
    }
    response.render('sobre', {
        tituloPagina: 'Sobre',
    });

});

app.get('/buscar-produto', async (request, response) => {
    if (!request.session.usuario) {
        response.redirect("/login");
        return;
    }
    let nome = request.query.nome;
    let sql = "SELECT * FROM financas WHERE titulo LIKE ?";
    let valores = ['%' + nome + '%'];
    const financas = await query(sql, valores);
    const categorias = await query('SELECT * FROM categoria');
    let totalEntradas = 0;
    let totalSaidas = 0;
    financas.map((fin) => {
        if (fin.tipo == 1) {
            totalEntradas += fin.valor;
        } else {
            totalSaidas += fin.valor;
        }
    })
    const total = totalEntradas - totalSaidas;
    financas.map((financa) => {
        categorias.map((categoria) => {
            if (financa.id_categoria === categoria.id_categoria) {
                financa.categoria = categoria.nome_categoria;
            }
        })
    })
    response.render('home', {
        tituloPagina: 'Finanças',
        listafinancas: financas,
        totalEntradas,
        totalSaidas,
        total,
    })
});

app.get('/contato', function (request, response) {
    if (!request.session.usuario) {
        response.redirect("/login");
        return;
    }
    response.render('contato', { tituloPagina: "Contato" });
})

app.post('/contato', async function (request, response) {

    let { nome, email, mensagem } = request.body;
    let mensagemErro = ""

    if (nome.length < 3)
        mensagemErro += 'Nome precisa ter pelo menos 3 letras!   -  ';

    if (mensagem.length < 20)
        mensagemErro += 'Mensagem precisa ter pelo menos 20 letras!   -  ';

    if (!email)
        mensagemErro += 'E-mail é inválido !   -  ';

    if (mensagemErro === "") {
        let sql = "INSERT INTO contato(nome, email, mensagem) VALUES(?, ?, ?)";
        let valores = [nome, email, mensagem];
        await query(sql, valores);
        mensagemErro = "Contato salvo no Banco"
    }
    response.render('contato', { tituloPagina: "Contato", mensagemErro });

})

app.listen(PORT, function () {
    console.log(`Server is running at port ${PORT}`);
});