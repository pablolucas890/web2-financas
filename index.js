const express = require('express');
const expressHandlebars = require('express-handlebars');
const path = require('path');

const mysql = require('mysql2/promise');

const PORT = process.env.PORT || 3001;

const app = express();

app.engine('handlebars', expressHandlebars.engine());

app.set('view engine', 'handlebars');

app.set('views', './views');

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));

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

app.get("/", async function (request, response) {

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
            if(financa.id_categoria === categoria.id_categoria) {
                financa.categoria = categoria.nome_categoria;
            }
        })
    })
    response.render('home', {
        tituloPagina: 'Produtos',
        listafinancas: financas,
        totalEntradas,
        totalSaidas,
        total,
    })
});

app.get("/excluir-produto/:id", async function (request, response) {
    const id = parseInt(request.params.id);
    if (!isNaN(id) && id > 0) {
        await query('DELETE FROM financas WHERE id_financa = ?', [id]);
    }
    response.redirect('/');
});

app.get('/buscar-produto/:nome', async (request, response) => {
    let nome = request.params.nome;
    let sql = "SELECT * FROM produtos WHERE nome_produto LIKE ?";
    let valores = ['%' + nome + '%'];
    const produtos = await query(sql, valores);
});

app.get('/editar-produto/:id', async function (request, response) {
    const id = parseInt(request.params.id);
    const dadosProduto = await query("SELECT * FROM financas WHERE id_financa = ?", [id]);
    if (dadosProduto.length === 0) {
        response.redirect("/");
        return;
    }
    const financa = dadosProduto[0];
    console.log(financa);
    response.render('editar-produto', {
        tituloPagina: 'Editar Produto',
        financa
    });
});

app.post('/editar-produto', async (request, response) => {

    let { id, nome, preco, ativo } = request.body;
    ativo = ativo ? 1 : 0;
    const dadosPagina = {
        tituloPagina: 'Editar Produto',
        mensagem: '',
        objProduto: { nome_produto: nome, id_produto: id, preco_produto: preco, ativo }
    }

    try {
        if (!nome)
            throw new Error('Nome é obrigatório!');
        if (preco <= 0)
            throw new Error('Preço inválido!');

        let sql = "UPDATE produtos SET nome_produto = ?, preco_produto = ?, ativo = ? WHERE id_produto = ?";
        let valores = [nome, preco, ativo, id];
        await query(sql, valores);
        dadosPagina.mensagem = 'Produto atualizado com sucesso!';
        dadosPagina.cor = "green";
    }
    catch (e) {
        dadosPagina.mensagem = e.message;
        dadosPagina.cor = "red";
    }
    response.render('editar-produto', dadosPagina);

});

app.get('/cadastrar-produto', function (request, response) {
    response.render('cadastrar-produto', { tituloPagina: 'Cadastrar Produto' });
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
        tituloPagina: 'Cadastrar Produto',
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

app.get('/sobre', function (request, response) {

    response.render('sobre', {
        tituloPagina: 'Esta é a página Sobre',
        nome: 'Ricardo',
        idade: 35
    });

});

app.get('/contato', function (request, response) {
    response.render('contato');
})

app.post('/contato', function (request, response) {

    let { nome, email, idade, linguagens } = request.body;

    let dadosRender = null;

    try {

        dadosRender = {
            dadosValidos: true, nome, email, idade, linguagens
        };

        if (nome.length < 3) {
            throw new Error('Nome precisa ter pelo menos 3 letras!');
        }

        if (!email) throw new Error('E-mail é inválido!');

    }
    catch (e) {
        dadosRender = {
            dadosValidos: false,
            mensagemErro: e.message
        }
    }

    response.render('contato', dadosRender);

})

app.listen(PORT, function () {
    console.log(`Server is running at port ${PORT}`);
});