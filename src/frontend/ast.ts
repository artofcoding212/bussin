// https://github.com/tlaceby/guide-to-interpreters-series
// -----------------------------------------------------------
// --------------          AST TYPES        ------------------
// ---     Defines the structure of our languages AST      ---
// -----------------------------------------------------------

export type NodeType =
  // STATEMENTS
  | "Program"
  | "VarDeclaration"
  | "FunctionDeclaration"
  | "IfStatement"
  | "ForStatement"
  | "TryCatchStatement"
  | "ThrowStatement"
  | "ClassDeclaration"
  | "ClassField"
  | "ReturnStatement"
  | "WhileStatement"
  | "BreakStatement"
  | "ContinueStatement"
  | "EnumDeclaration"

  // EXPRESSIONS
  | "AssignmentExpr"
  | "MemberExpr"
  | "CallExpr"
  | "NewExpr"
  | "MatchExpr"

  // LITERALS
  | "Property"
  | "ObjectLiteral"
  | "ArrayLiteral"
  | "NumericLiteral"
  | "Identifier"
  | "StringLiteral"
  | "BinaryExpr";

/**
 * Statements do not result in a value at runtime.
 They contain one or more expressions internally */
export interface Stmt {
  kind: NodeType;
}

/**
 * Defines a block which contains many statements.
 * -  Only one program will be contained in a file.
 */
export interface Program extends Stmt {
  kind: "Program";
  body: Stmt[];
}

export interface ThrowStmt extends Stmt {
  kind: "ThrowStatement";
  value: Expr;
}

export interface EnumDeclarationStmt extends Stmt {
  kind: "EnumDeclaration";
  members: string[];
  name: string;
}

export interface BreakStmt extends Stmt {
  kind: "BreakStatement";
}

export interface ContinueStmt extends Stmt {
  kind: "ContinueStatement";
}

export interface WhileStmt extends Stmt {
  kind: "WhileStatement";
  value: Expr;
  body: Stmt[];
}

export interface ReturnStmt extends Stmt {
  kind: "ReturnStatement";
  value: Expr;
}

export interface ClassDeclarationStmt extends Stmt {
  kind: "ClassDeclaration";
  name: string;
  fields: Set<string>;
  staticFields: Map<string, Expr>;
  funs: Map<string, FunctionDeclaration>;
  staticFuns: Map<string, FunctionDeclaration>;
}

export interface VarDeclaration extends Stmt {
  kind: "VarDeclaration";
  constant: boolean;
  identifier: string;
  value?: Expr;
}

export interface IfStatement extends Stmt {
  kind: "IfStatement";
  test: Expr;
  body: Stmt[];
  alternate?: Stmt[];
}

export interface TryCatchStatement extends Stmt {
  kind: "TryCatchStatement";
  body: Stmt[];
  alternate: Stmt[];
}

export interface FunctionDeclaration extends Stmt {
  kind: "FunctionDeclaration";
  parameters: string[];
  name: string;
  body: Stmt[];
}

export interface ForStatement extends Stmt {
  kind: "ForStatement";
  init: VarDeclaration;
  test: Expr;
  update: AssignmentExpr;
  body: Stmt[];
}

/**  Expressions will result in a value at runtime unlike Statements */
export interface Expr extends Stmt {}

/**
 * Instantiates a given class, calling its constructor if it has one.
 * You can instantiate on a member expression ("foo.bar") or a regular identifier ("foo").
 * Example: new Foo(1, 2, 3);
 */
export interface NewExpr extends Expr {
  kind: "NewExpr";
  target: Expr;
  args: Array<Expr>;
}


/**
 * Matches on the given value, similar to a switch statement.
 * You can match on tagged enums with the Enum.Name(variable) syntax, same goes for normal enums.
 * Multiple matches can be done with the comma operator.
 * To choose the default case, use the default keyword.
 * Example: match 3 { 1,2,3 => { true } default => { false } }
 */
export interface MatchExpr extends Expr {
  kind: "MatchExpr";
  cases: Map<Expr[], Stmt[]>;
  defaultCase?: Stmt[];
  value: Expr;
}

/**
 * A operation with two sides seperated by a operator.
 * Both sides can be ANY Complex Expression.
 * - Supported Operators -> + | - | / | * | %
 */
export interface BinaryExpr extends Expr {
  kind: "BinaryExpr";
  left: Expr;
  right: Expr;
  operator: string; // needs to be of type BinaryOperator
}

// foo.bar()
// foo["bar"]()

export interface CallExpr extends Expr {
  kind: "CallExpr";
  args: Expr[];
  caller: Expr;
}

export interface MemberExpr extends Expr {
  kind: "MemberExpr";
  object: Expr;
  property: Expr;
  computed: boolean;
}

export interface AssignmentExpr extends Expr {
  kind: "AssignmentExpr";
  assigne: Expr;
  value: Expr;
}

// LITERAL / PRIMARY EXPRESSION TYPES
/**
 * Represents a user-defined variable or symbol in source.
 */
export interface Identifier extends Expr {
  kind: "Identifier";
  symbol: string;
}

/**
 * Represents a numeric constant inside the soure code.
 */
export interface NumericLiteral extends Expr {
  kind: "NumericLiteral";
  value: number;
}

export interface StringLiteral extends Expr {
  kind: "StringLiteral";
  value: string;
}

export interface Property extends Expr {
  kind: "Property";
  key: string;
  value?: Expr;
}

export interface ObjectLiteral extends Expr {
  kind: "ObjectLiteral";
  properties: Property[];
}

export interface ArrayLiteral extends Expr {
  kind: "ArrayLiteral";
  values: Array<Expr>;
}