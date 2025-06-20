import { Stmt, Program, Expr, BinaryExpr, NumericLiteral, Identifier, VarDeclaration, AssignmentExpr, Property, ObjectLiteral, CallExpr, MemberExpr, FunctionDeclaration, StringLiteral, IfStatement, ForStatement, TryCatchStatement, ArrayLiteral, ClassDeclarationStmt, ReturnStmt, NewExpr, WhileStmt, EnumDeclarationStmt, MatchExpr, ThrowStmt, BreakStmt, ContinueStmt } from "./ast";
import { tokenize, Token, TokenType } from "./lexer";

export default class Parser {
    private tokens: Token[] = [];

    // This may look unnecessary, but it does, fortunately, work!
    private lineCounter: number = 1;
    private column: number = 0;
    private nonNLLine: number = 0;
    private nonNLColumn: number = 0;
    private lastNonNLLine: number = 0;
    private lastNonNLColumn: number = 0;

    private shift(): Token {
        const token = this.tokens.shift();
        switch(token.type) {
            case TokenType.NewLine:
                this.lineCounter++;
                break;
            case TokenType.String: {
                const split = token.raw.split("\n");
                this.lineCounter += split.length - 1;
                if(split.length > 1) {
                    this.column = split[split.length - 1].length + 1; // +1 for quote
                }
            }
            // eslint-disable-next-line no-fallthrough
            default:
                this.lastNonNLLine = this.nonNLLine;
                this.nonNLLine = this.lineCounter;
                if(token.type != TokenType.String && (token.type != TokenType.Identifier || token.value != "finishExit")) {
                    this.lastNonNLLine = this.nonNLLine;
                    this.nonNLLine = this.lineCounter;
                    this.column += token.value.length;
                    this.lastNonNLColumn = this.nonNLColumn;
                    this.nonNLColumn = this.column;
                }
                this.lastNonNLColumn = this.nonNLColumn;
                this.nonNLColumn = this.column;
                break;
        }
        return token;
    }

    private at(): Token {
        let token = this.tokens[0] as Token;
        while(token.type == TokenType.NewLine) {
            this.shift();
            token = this.tokens[0] as Token;
        }
        return token;
    }

    private not_eof(): boolean {
        return this.at().type != TokenType.EOF;
    }

    private eat(): Token {
        let prev;
        do {
            prev = this.shift();
        } while (prev.type == TokenType.NewLine);

        return prev;
    }

    private expect(type: TokenType, err: string): Token {
        const prev = this.eat();

        if (!prev || prev.type != type) {
            console.error(`Parser error: (Ln ${this.lastNonNLLine}, Col ${this.lastNonNLColumn + 1})\n`, err, "Expecting:", TokenType[type], 'Got:', TokenType[prev.type]);
            process.exit(1)
        }

        return prev;
    }
    public produceAST(sourceCode: string): Program {
        this.tokens = tokenize(sourceCode);

        const program: Program = {
            kind: "Program",
            body: [],
        }

        // Parse until end of file
        while (this.not_eof()) {
            program.body.push(this.parse_stmt());
        }
        return program;
    }

    private parse_stmt(): Stmt {
        switch (this.at().type) {
            case TokenType.Let:
            case TokenType.Const:
                return this.parse_var_declaration();
            case TokenType.Fn: {
                this.eat(); // eat fn keyword
                const name = this.expect(TokenType.Identifier, "Expected an Identifier for the function name in a function declaration.").value;
                return this.parse_function_declaration(name);
            }
            case TokenType.Throw: {
                this.eat();
                const value = this.parse_expr();
                if (this.at().type === TokenType.Semicolon) this.eat();
                return {
                    kind: "ThrowStatement",
                    value,
                } as ThrowStmt;
            }
            case TokenType.If:
                return this.parse_if_statement();
            case TokenType.For:
                return this.parse_for_statement();
            case TokenType.NewLine:
                this.at(); // will remove all new lines
                return this.parse_stmt();
            case TokenType.Class:
                return this.parse_class_declaration();
            case TokenType.Return:
                return this.parse_return_statement();
            case TokenType.Enum:
                return this.parse_enum_declaration();
            case TokenType.While:
                return this.parse_while_statement();
            case TokenType.Break:
                this.eat();
                return {kind: "BreakStatement"} as BreakStmt;
            case TokenType.Continue:
                this.eat();
                return {kind: "ContinueStatement"} as ContinueStmt;
            default:
                return this.parse_expr();
        }
    }

    parse_enum_declaration(): EnumDeclarationStmt {
        this.eat();
        const name = this.expect(TokenType.Identifier, `Expected an identifier following the "enum" keyword.`).value;
        this.expect(TokenType.OpenBrace, `Left brace ("{") expected following the enum declaration's name.`);
        const members = new Array<string>();
        while (this.at().type != TokenType.CloseBrace) {
            members.push(this.expect(TokenType.Identifier, `Identifier expected for enum name.`).value);
            if (this.at().type != TokenType.CloseBrace) {
                this.expect(TokenType.Comma, `Comma expected following enum member.`);
            }
        }
        this.expect(TokenType.CloseBrace, `Right brace ("}") expected following enum declaration body.`);
        return {
            kind: "EnumDeclaration",
            members,
            name,
        } as EnumDeclarationStmt;
    }

    parse_while_statement(): WhileStmt {
        this.eat();
        this.expect(TokenType.OpenParen, `Opening parenthesis ("(") expected after "while" keyword.`);
        const value = this.parse_expr();
        this.expect(TokenType.CloseParen, `Closing parenthesis (")") expected after while expression.`);
        return {
            kind: "WhileStatement",
            body: this.parse_block_statement(),
            value,
        } as WhileStmt;
    }
    
    parse_block_statement(): Stmt[] {
        this.expect(TokenType.OpenBrace, "Opening brace (\"{\") expected while parsing code block.");

        const body: Stmt[] = [];

        while (this.not_eof() && this.at().type !== TokenType.CloseBrace) {
            const stmt = this.parse_stmt();
            body.push(stmt);
        }

        this.expect(TokenType.CloseBrace, "Closing brace (\"}\") expected while parsing code block.");

        return body;
    }

    parse_return_statement(): ReturnStmt {
        this.eat();
        let value;
        if (this.at().type != TokenType.Semicolon) {
            value = this.parse_expr();
            if (this.at().type == TokenType.Semicolon) {
                this.eat();
            }
        } else {
            this.eat();
            value = { kind: "Identifier", symbol: "null" } as Identifier;
        }
        
        const r: ReturnStmt = {
            kind: "ReturnStatement",
            value,
        };
        return r;
    }

    /*
    Class syntax:
    class Foo {
        field_name;
        static static_field_name = static_field_value;

        fun_name(...args) {

        }

        static static_fun_name() {
            this.static_field_name = 'foo'
        }
    }

    ? We could potentially addd support for public/private fields and functions, but who really needs them?
    */
    parse_class_declaration(): ClassDeclarationStmt {
        this.eat();
        const name = this.expect(TokenType.Identifier, `Expected an Identifier following the "class" keyword.`).value;
        this.expect(TokenType.OpenBrace, `Opening brace ("{") expected following class name.`);
        
        const fields = new Set<string>();
        const staticFields = new Map<string, Expr>();
        const funs = new Map<string, FunctionDeclaration>();
        const staticFuns = new Map<string, FunctionDeclaration>();

        while (this.not_eof() && this.at().type !== TokenType.CloseBrace) {
            let is_static = false;
            if (this.at().type == TokenType.Static) {
                this.eat();
                is_static = true;
            }

            const name = this.expect(TokenType.Identifier, `Identifier expected to start a class field/function.`).value;
            if (this.at().type == TokenType.OpenParen) {
                if (is_static) {
                    staticFuns.set(name, this.parse_function_declaration(name));
                } else {
                    funs.set(name, this.parse_function_declaration(name));
                }
            } else {
                if (is_static) {
                    this.expect(TokenType.Equals, `Expected equals ("=") following static field declaration to show the initial value of the static field.`);
                    staticFields.set(name, this.parse_expr());
                } else {
                    fields.add(name);
                }
            }

            if (this.at().type == TokenType.Semicolon) {
                this.eat();
            }
        }

        this.expect(TokenType.CloseBrace, `Closing brace ("}") expected following class body.`);
        const c = {
            kind: "ClassDeclaration",
            fields,
            staticFields,
            funs,
            staticFuns,
            name,
        } as ClassDeclarationStmt;
        return c;
    }

    parse_for_statement(): Stmt {
        this.eat(); // eat "for" keyword
        this.expect(TokenType.OpenParen, "Opening parenthesis (\"(\") expected following \"for\" statement.");
        const init = this.parse_var_declaration();
        const test = this.parse_expr();

        //this.expect(TokenType.Semicolon, "Semicolon (\";\") expected following \"test expression\" in \"for\" statement.");

        const update = this.parse_expr();

        this.expect(TokenType.CloseParen, "Closing parenthesis (\")\") expected following \"additive expression\" in \"for\" statement.");

        const body = this.parse_block_statement();

        return {
            kind: 'ForStatement',
            init,
            test,
            update,
            body,
        } as ForStatement;
    }
    parse_if_statement(): Stmt {
        this.eat(); // eat if keyword
        this.expect(TokenType.OpenParen, "Opening parenthesis (\"(\") expected following \"if\" statement.");

        const test = this.parse_expr();

        this.expect(TokenType.CloseParen, "Closing parenthesis (\")\") expected following \"if\" statement.");

        const body = this.parse_block_statement();

        let alternate: Stmt[] = [];

        if (this.at().type == TokenType.Else) {
            this.eat(); // eat "else"

            if (this.at().type == TokenType.If) {
                alternate = [this.parse_if_statement()];
            } else {
                alternate = this.parse_block_statement();
            }
        }

        return {
            kind: 'IfStatement',
            body: body,
            test,
            alternate
        } as IfStatement;
    }

    parse_function_declaration(name: string): FunctionDeclaration {
        const args = this.parse_args();
        const params: string[] = [];

        for (const arg of args) {
            if (arg.kind !== "Identifier") {
                throw "Arguments for \"fn\" statement must be of type \"String\"."
            }

            params.push((arg as Identifier).symbol);
        }

        const body = this.parse_block_statement();

        const fn = {
            body, name, parameters: params, kind: "FunctionDeclaration"
        } as FunctionDeclaration;

        return fn;
    }

    parse_var_declaration(): Stmt {
        const isConstant = this.eat().type == TokenType.Const;
        const identifier = this.expect(TokenType.Identifier, "Variable name expected following \"let\"/\"const\" statement.").value;

        if (this.at().type == TokenType.Semicolon) {
            this.eat() // expect semicolon

            if (isConstant)
                throw "Constant variables must have assigned values."

            return { kind: "VarDeclaration", identifier, constant: false, value: undefined } as VarDeclaration;
        }

        this.expect(TokenType.Equals, "Equals (\"=\") expected following \"identifier\" declaration in \"let\"/\"const\" statement.");

        const declaration = { kind: "VarDeclaration", value: this.parse_expr(), constant: isConstant, identifier } as VarDeclaration;

        if (this.at().type == TokenType.String) this.eat(); // eaat the " at the end

        //this.expect(TokenType.Semicolon, "Semicolon (\";\") expected at the end of \"let\"/\"const\" statement.");

        return declaration;
    }

    private parse_expr(): Expr {
        const data = this.parse_new_expr();

        // before returning, if it's a ternary we don't want to return the direct value.
        if(this.at().type == TokenType.Ternary) {
            if(data.kind != "BinaryExpr" && data.kind != "Identifier") {
                throw new Error("Expected BinaryExpr or Identifier following ternary expression.");
            }
            this.eat();

            const expr = this.parse_expr();

            if(expr.kind != "BinaryExpr" || (expr as BinaryExpr).operator != "|") {
                throw new Error("Bar (\"|\") expected following left side of ternary operator (\"->\").");
            }
            
            const ifStmt = { kind: "IfStatement", test: data, body: [(expr as BinaryExpr).left], alternate: [(expr as BinaryExpr).right] } as IfStatement;
            return {kind:"CallExpr",args:[],caller:{kind:"FunctionDeclaration",parameters:[],name:"<anonymous>",body:[ifStmt]} as FunctionDeclaration} as CallExpr;
        }

        if (this.at().type == TokenType.Semicolon) { // Support semicolons anywhere in expressions to allow for the destruction of ambiguous syntax if present
            this.eat();
        }
        return data;
    }

    private parse_new_expr(): Expr {
        if (this.at().type != TokenType.New) {
            return this.parse_assignment_expr();
        }

        this.eat();
        const target = this.parse_member_expr(); //? We do this to only support identifiers and member expressions on calls, as any lower precedence would leave it to find a call expression
        this.expect(TokenType.OpenParen, `Expected an open parenthesis ("(") following the "new" expression's name.`);
        const args = new Array<Expr>();
        while (this.at().type != TokenType.CloseParen) {
            args.push(this.parse_expr());
            if (this.at().type != TokenType.CloseParen) {
                this.expect(TokenType.Comma, `Expected a comma (",") or closing parenthesis (")") following a "new" expression's argument.`);
            }
        }
        this.expect(TokenType.CloseParen, `Expected a closing parenthesis (")") following the "new" expression's parameters.`);
        
        return {
            kind: "NewExpr",
            target,
            args,
        } as NewExpr;
    }

    private parse_assignment_expr(): Expr {
        const left = this.parse_object_expr();

        if (this.at().type == TokenType.Equals) {
            this.eat(); // advance past the equals
            const value = this.parse_expr();

            return { value, assigne: left, kind: "AssignmentExpr" } as AssignmentExpr;
        }

        return left;
    }

    private parse_and_statement(): Expr {
        let left = this.parse_additive_expr();

        if (["&&", "|"].includes(this.at().value)) {
            const operator = this.eat().value;
            const right = this.parse_additive_expr();

            left = {
                kind: "BinaryExpr",
                left, right, operator
            } as BinaryExpr;
            while(this.at().type == TokenType.And || this.at().type == TokenType.Bar) {
                left = {
                    kind: "BinaryExpr",
                    left,
                    operator: this.eat().value,
                    right: this.parse_expr(),
                } as BinaryExpr;
            }
        }

        return left;
    }

    private parse_try_catch_expr(): Expr {
        if (this.at().type != TokenType.Identifier || this.at().value !== 'try') {
            return this.parse_and_statement()
        }

        this.eat();

        const body = this.parse_block_statement();

        if (this.at().type != TokenType.Identifier || this.at().value !== 'catch') throw "\"try\" statement must be followed by a \"catch\" statement."

        this.eat();

        const alternate = this.parse_block_statement();

        return {
            kind: "TryCatchStatement",
            body,
            alternate,
        } as TryCatchStatement
    }
    private parse_object_expr(): Expr {
        if (this.at().type !== TokenType.OpenBrace) {
            return this.parse_array_expr();
        }

        this.eat(); // advance past {

        const properties = new Array<Property>();

        while (this.not_eof() && this.at().type != TokenType.CloseBrace) {
            // { key: val, key2: val }
            if(this.at().type != TokenType.Identifier && this.at().type != TokenType.String) {
                throw new Error("Identifier expected following \"Object\" expression.");
            }
            const key = this.eat().value;

            // Allows shorthand key: pair -> { key, }
            if (this.at().type == TokenType.Comma) {
                this.eat(); // advance past comma (,)
                properties.push({ key, kind: "Property" });
                continue;
            } // Allows shorthand key: pair -> { key }
            else if (this.at().type == TokenType.CloseBrace) {
                properties.push({ key, kind: "Property" });
                continue;
            }
            // { key: val }

            this.expect(TokenType.Colon, "Colon (\":\") expected following \"identifier\" in \"Object\" expression.");
            const value = this.parse_expr();

            properties.push({ key, value, kind: "Property" });

            if (this.at().type != TokenType.CloseBrace) {
                this.expect(TokenType.Comma, "Comma (\",\") or closing brace (\"}\") expected after \"property\" declaration.");
            }
        }

        this.expect(TokenType.CloseBrace, "Closing brace (\"}\") expected at the end of \"Object\" expression.");
        return { kind: "ObjectLiteral", properties } as ObjectLiteral;
    }

    private parse_array_expr(): Expr {
        if(this.at().type !== TokenType.OpenBracket) {
            return this.parse_try_catch_expr();
        }

        this.eat(); // advance past [

        const values = new Array<Expr>();

        while (this.not_eof() && this.at().type != TokenType.CloseBracket) {
            values.push(this.parse_expr());

            if (this.at().type != TokenType.CloseBracket) {
                this.expect(TokenType.Comma, "Comma (\",\") or closing bracket (\"]\") expected after \"value\" in array.");
            }
        }

        this.expect(TokenType.CloseBracket, "Closing Bracket (\"]\") expected at the end of \"Array\" expression.");
        return { kind: "ArrayLiteral", values } as ArrayLiteral;
    }

    private parse_additive_expr(): Expr {
        let left = this.parse_multiplicative_expr();

        while (["+", "-", "==", "!=", "<", ">"].includes(this.at().value)) {
            const operator = this.eat().value;
            const right = this.parse_multiplicative_expr();
            left = {
                kind: "BinaryExpr",
                left, right, operator
            } as BinaryExpr;
        }

        return left;
    }

    private parse_multiplicative_expr(): Expr {
        let left = this.parse_call_member_expr();

        while (["/", "*", "%"].includes(this.at().value)) {
            const operator = this.eat().value;
            const right = this.parse_call_member_expr();
            left = {
                kind: "BinaryExpr",
                left, right, operator
            } as BinaryExpr;
        }

        return left;
    }

    // foo.x()
    private parse_call_member_expr(): Expr {
        const member = this.parse_member_expr();

        if (this.at().type == TokenType.OpenParen) {
            return this.parse_call_expr(member);
        }

        return member;
    }
    private parse_call_expr(caller: Expr): Expr {
        let call_expr: Expr = {
            kind: "CallExpr",
            caller,
            args: this.parse_args(),
        } as CallExpr;

        // allow chaining: foo.x()()
        if (this.at().type == TokenType.OpenParen) {
            call_expr = this.parse_call_expr(call_expr);
        }

        return call_expr;
    }

    private parse_args(): Expr[] {
        this.expect(TokenType.OpenParen, "Opening parenthesis (\"(\") expected while parsing arguments.");
        const args = this.at().type == TokenType.CloseParen
            ? []
            : this.parse_args_list();

        this.expect(TokenType.CloseParen, "Closing parenthesis (\")\") expected while parsing arguments.");

        return args;
    }

    // foo(x = 5, v = "Bar")
    private parse_args_list(): Expr[] {
        const args = [this.parse_expr()];

        while (this.at().type == TokenType.Comma && this.eat()) {
            args.push(this.parse_expr());
        }

        return args;
    }

    private parse_member_expr(): Expr {
        let object = this.parse_primary_expr();

        while (this.at().type == TokenType.Dot || this.at().type == TokenType.OpenBracket) {
            const operator = this.eat();
            let property: Expr;
            let computed: boolean;

            // non-computed values (obj.expr)
            if (operator.type == TokenType.Dot) {
                computed = false;
                // get identifier
                property = this.parse_primary_expr();

                if (property.kind !== "Identifier") {
                    throw "Dot operator (\".\") is illegal without right-hand-side (<-) being an Identifier."
                }
            } // computed values (obj[computedVal])
            else {
                computed = true;
                property = this.parse_expr();

                this.expect(TokenType.CloseBracket, "Closing bracket (\"}\") expected following \"computed value\" in \"Member\" expression.");
            }

            object = {
                kind: "MemberExpr",
                object,
                property,
                computed
            } as MemberExpr;
        }

        return object;
    }

    // Orders of Presidence
    // Assignment
    // Object
    // AdditiveExpr
    // MultiplicativeExpr
    // Call
    // Member
    // PrimaryExpr
    private parse_primary_expr(): Expr {
        const tk = this.at().type;

        switch (tk) {
            case TokenType.Identifier:
                return { kind: "Identifier", symbol: this.eat().value } as Identifier;
            case TokenType.Number:
                return {
                    kind: "NumericLiteral",
                    value: parseFloat(this.eat().value)
                } as NumericLiteral;
            case TokenType.String:
                return {
                    kind: "StringLiteral",
                    value: this.eat().value,
                } as StringLiteral;
            case TokenType.Fn: {
                this.eat(); // eat fn keyword
                const name = this.at().type == TokenType.Identifier ? this.eat().value : "<anonymous>";
                return this.parse_function_declaration(name);
            }
            case TokenType.OpenParen: {
                this.eat(); // eat the opening paren
                const value = this.parse_expr();

                this.expect(TokenType.CloseParen, `Unexpected token (${JSON.stringify(this.at().toString())}) found while parsing arguments.`); // closing paren

                return value;
            }
            case TokenType.Match: {
                this.eat();
                const value = this.parse_expr();
                this.expect(TokenType.OpenBrace, `Expected an open brace ("{") to begin the match body.`);
                let defaultCase: Stmt[]|undefined = undefined;
                const cases = new Map<Expr[], Stmt[]>();

                while (this.at().type != TokenType.CloseBrace) {
                    const case_arr = [];
                    let is_default = false;
                    while (this.at().type != TokenType.Arrow && this.not_eof()) {
                        if (this.at().type == TokenType.Default) {
                            this.eat();
                            is_default = true;
                        } else {
                            case_arr.push(this.parse_expr());
                        }
                        if (this.at().type != TokenType.Arrow) {
                            this.expect(TokenType.Comma, `Expected a comma (",") to separate match cases that coerce to one body.`);
                        }
                    }
                    this.expect(TokenType.Arrow, `Expected an arrow ("=>") following match cases to coerce into a body.`);
                    const body = this.parse_block_statement();
                    if (is_default) {
                        if (defaultCase != undefined) {
                            throw `Can only have one default case in a match body.`;
                        }
                        // To prevent adding unnecessary bloat to the interpreter for match expressions,
                        // we separate the default case from other cases despite them being able to be packaged
                        // together. 
                        if (case_arr.length > 0) {
                            cases.set(case_arr, body);
                        }
                        defaultCase = body;
                    } else {
                        cases.set(case_arr, body);
                    }
                }

                this.expect(TokenType.CloseBrace, `Expected a closing brace ("}") to end the match body.`);
                return {
                    kind: "MatchExpr",
                    cases,
                    defaultCase,
                    value,
                } as MatchExpr;
            }
            default:
                console.error("Unexpected token found during parsing!", this.at().toString());
                process.exit(1);
        }
    }
}
