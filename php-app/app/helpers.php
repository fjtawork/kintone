<?php

declare(strict_types=1);

// グローバルフック関数 — HookManager のインスタンスが global $hookManager にセットされた後に使用可能

function add_action(string $hook, callable $callback, int $priority = 10): void
{
    global $hookManager;
    $hookManager->add_action($hook, $callback, $priority);
}

function do_action(string $hook, mixed ...$args): void
{
    global $hookManager;
    $hookManager->do_action($hook, ...$args);
}

function add_filter(string $hook, callable $callback, int $priority = 10): void
{
    global $hookManager;
    $hookManager->add_filter($hook, $callback, $priority);
}

function apply_filters(string $hook, mixed $value, mixed ...$args): mixed
{
    global $hookManager;
    return $hookManager->apply_filters($hook, $value, ...$args);
}
