from example_python_cli.main import main


def test_main(capsys: object) -> None:
    main()
    captured = capsys.readouterr()
    assert captured.out == "Hello from example-python-cli!\n"
