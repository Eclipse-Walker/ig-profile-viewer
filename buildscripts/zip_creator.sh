#!/bin/bash

usage() {
    echo "Usage: $0 -o output_zip_file input_files_or_directory..."
    echo "  -o output_zip_file  Specify the name of the output ZIP file."
    echo "  input_files_or_directory  List of files and/or directories to be zipped."
    exit 1
}

while getopts ":o:" opt; do
    case ${opt} in
        o )
            output_zip="$OPTARG"
            ;;
        \? )
            usage
            ;;
    esac
done
shift $((OPTIND -1))

if [ -z "$output_zip" ]; then
    echo "Error: Output ZIP file name is required."
    usage
fi

if [ $# -eq 0 ]; then
    echo "Error: At least one input file or directory is required."
    usage
fi

zip -r "$output_zip" "$@"

if [ $? -eq 0 ]; then
    echo "Successfully created $output_zip"
else
    echo "Failed to create $output_zip"
    exit 1
fi
