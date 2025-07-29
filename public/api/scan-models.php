<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$modelsDir = '../models/';
$glbFiles = [];

if (is_dir($modelsDir)) {
    $files = scandir($modelsDir);
    foreach ($files as $file) {
        if (pathinfo($file, PATHINFO_EXTENSION) === 'glb') {
            $glbFiles[] = $file;
        }
    }
}

echo json_encode($glbFiles);
?>